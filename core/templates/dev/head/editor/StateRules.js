// Copyright 2014 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Controllers for rules corresponding to a state's interaction.
 *
 * @author sll@google.com (Sean Lip)
 */

// A state-specific cache for interaction handlers. It stores handlers
// corresponding to an interaction id so that they can be restored if the
// interaction is changed back while the user is still in this state. This
// cache should be reset each time the state editor is initialized.
oppia.factory('answerGroupsCache', [function() {
  var _cache = {};
  return {
    reset: function() {
      _cache = {};
    },
    contains: function(interactionId) {
      return _cache.hasOwnProperty(interactionId);
    },
    set: function(interactionId, answerGroups) {
      _cache[interactionId] = angular.copy(answerGroups);
    },
    get: function(interactionId) {
      if (!_cache.hasOwnProperty(interactionId)) {
        return null;
      }
      return angular.copy(_cache[interactionId]);
    }
  };
}]);


oppia.factory('rulesService', [
    'stateInteractionIdService', 'INTERACTION_SPECS', 'answerGroupsCache',
    'editorContextService', 'changeListService', 'explorationStatesService', 'graphDataService',
    'warningsData',
    function(
      stateInteractionIdService, INTERACTION_SPECS, answerGroupsCache,
      editorContextService, changeListService, explorationStatesService, graphDataService,
      warningsData) {

  var _answerGroupsMemento = null;
  var _defaultOutcomeMemento = null;
  // Represents the current selected answer group, starting at index 0. If the
  // index equal to the number of answer groups (answerGroups.length), then it
  // is referring to the default outcome.
  var _activeGroupIndex = null;
  var _activeRuleIndex = null;
  var _answerGroups = null;
  var _defaultOutcome = null;
  var _answerChoices = null;

  var _saveAnswerGroups = function(newGroups) {
    var oldGroups = _answerGroupsMemento;
    var oldDefaultOutcome = _defaultOutcomeMemento;
    if (newGroups && oldGroups && !angular.equals(newGroups, oldGroups)) {
      _answerGroups = newGroups;

      changeListService.editStateProperty(
        editorContextService.getActiveStateName(), 'answer_groups',
        angular.copy(newGroups), angular.copy(oldGroups));

      var activeStateName = editorContextService.getActiveStateName();
      var _stateDict = explorationStatesService.getState(activeStateName);
      _stateDict.interaction.answer_groups = angular.copy(
        _answerGroups);
      explorationStatesService.setState(activeStateName, _stateDict);

      graphDataService.recompute();
      _answerGroupsMemento = angular.copy(newGroups);
    }
  };

  var _saveDefaultOutcome = function(newDefaultOutcome) {
    var oldDefaultOutcome = _defaultOutcomeMemento;
    if (!angular.equals(newDefaultOutcome, oldDefaultOutcome)) {
      _defaultOutcome = newDefaultOutcome;

      changeListService.editStateProperty(
        editorContextService.getActiveStateName(),
        'default_outcome', angular.copy(newDefaultOutcome),
        angular.copy(oldDefaultOutcome));

      var activeStateName = editorContextService.getActiveStateName();
      var _stateDict = explorationStatesService.getState(activeStateName);
      _stateDict.interaction.default_outcome = angular.copy(
        _defaultOutcome);
      explorationStatesService.setState(activeStateName, _stateDict);

      graphDataService.recompute();
      _defaultOutcomeMemento = angular.copy(newDefaultOutcome);
    }
  };

  return {
    // The 'data' arg is a list of interaction handlers for the currently-active state.
    init: function(data) {
      answerGroupsCache.reset();

      _answerGroups = angular.copy(data.answerGroups);
      _defaultOutcome = angular.copy(data.defaultOutcome);
      answerGroupsCache.set(
        stateInteractionIdService.savedMemento, _answerGroups);

      _answerGroupsMemento = angular.copy(_answerGroups);
      _defaultOutcomeMemento = angular.copy(
        _defaultOutcome);
      _activeGroupIndex = 0;
      _activeRuleIndex = 0;
    },
    onInteractionIdChanged: function(newInteractionId, callback) {
      if (answerGroupsCache.contains(newInteractionId)) {
        _answerGroups = answerGroupsCache.get(newInteractionId);
      } else {
        // Preserve the default outcome unless the interaction is terminal.
        // Recreate the default outcome if switching away from a terminal
        // interaction.
        _answerGroups = [];
        if (newInteractionId) {
          if (INTERACTION_SPECS[newInteractionId].is_terminal) {
            _defaultOutcome = null;
          } else if (!_defaultOutcome) {
            // TODO(bhenning): This code should ideally not be coupled with the
            // states schema structure of an outcome.
            _defaultOutcome = {
              'feedback': [],
              'dest': editorContextService.getActiveStateName()
            };
          }
        }
      }

      _saveAnswerGroups(_answerGroups);
      _saveDefaultOutcome(_defaultOutcome);
      answerGroupsCache.set(newInteractionId, _answerGroups);

      _answerGroupsMemento = angular.copy(_answerGroups);
      _defaultOutcomeMemento = angular.copy(
        _defaultOutcome);
      _activeGroupIndex = 0;
      _activeRuleIndex = 0;

      if (callback) {
        callback();
      }
    },
    getActiveGroupIndex: function() {
      return _activeGroupIndex;
    },
    changeActiveGroupIndex: function(newIndex) {
      _activeGroupIndex = newIndex;
      _activeRuleIndex = 0;
    },
    getActiveRuleIndex: function() {
      return _activeRuleIndex;
    },
    changeActiveRuleIndex: function(newIndex) {
      _activeRuleIndex = newIndex;
    },
    getAnswerChoices: function() {
      return angular.copy(_answerChoices);
    },
    deleteGroup: function(index) {
      if (!window.confirm('Are you sure you want to delete this response?')) {
        return false;
      }
      _answerGroupsMemento = angular.copy(_answerGroups);
      _answerGroups.splice(index, 1);
      _saveAnswerGroups(_answerGroups);
      _activeGroupIndex = 0;
      return true;
    },
    saveActiveGroup: function(activeRules, activeOutcome) {
      var group = _answerGroups[_activeGroupIndex];
      group.rule_specs = activeRules;
      group.outcome = activeOutcome;
      _saveAnswerGroups(_answerGroups);
    },
    saveDefaultOutcome: function(outcome) {
      _saveDefaultOutcome(outcome);
    },
    // Updates answer choices when the interaction requires it -- for example,
    // the rules for multiple choice need to refer to the multiple choice
    // interaction's customization arguments.
    updateAnswerChoices: function(newAnswerChoices) {
      _answerChoices = newAnswerChoices;
    },
    getAnswerGroups: function() {
      return angular.copy(_answerGroups);
    },
    getDefaultOutcome: function() {
      return angular.copy(_defaultOutcome);
    },
    // This registers the change to the handlers in the list of changes, and also
    // updates the states object in explorationStatesService.
    save: function(newGroups, defaultOutcome) {
      _saveAnswerGroups(newGroups);
      _saveDefaultOutcome(defaultOutcome);
    },
  };
}]);


oppia.controller('StateRules', [
    '$scope', '$rootScope', '$modal', 'stateInteractionIdService',
    'editorContextService', 'warningsData', 'rulesService', 'routerService',
    function(
      $scope, $rootScope, $modal, stateInteractionIdService,
      editorContextService, warningsData, rulesService, routerService) {
  $scope.editorContextService = editorContextService;

  $scope.changeActiveGroupIndex = function(newIndex) {
    $rootScope.$broadcast('externalSave');
    rulesService.changeActiveGroupIndex(newIndex);
    $scope.activeGroupIndex = rulesService.getActiveGroupIndex();
  };

  $scope.getCurrentInteractionId = function() {
    return stateInteractionIdService.savedMemento;
  };

  $scope.isCreatingNewState = function(outcome) {
    // TODO(bhenning): Don't duplicate this with the private constant in
    // groupEditor.js.
    var _PLACEHOLDER_OUTCOME_DEST = '/';
    return outcome && outcome.dest == _PLACEHOLDER_OUTCOME_DEST;
  };

  $scope.$on('initializeAnswerGroups', function(evt, data) {
    rulesService.init(data);
    $scope.answerGroups = rulesService.getAnswerGroups();
    $scope.defaultOutcome = rulesService.getDefaultOutcome();
    $scope.activeGroupIndex = rulesService.getActiveGroupIndex();
    $rootScope.$broadcast('externalSave');
  });

  $scope.$on('onInteractionIdChanged', function(evt, newInteractionId) {
    $rootScope.$broadcast('externalSave');
    rulesService.onInteractionIdChanged(newInteractionId, function() {
      $scope.answerGroups = rulesService.getAnswerGroups();
      $scope.defaultOutcome = rulesService.getDefaultOutcome();
      $scope.activeGroupIndex = rulesService.getActiveGroupIndex();
    });
  });

  $scope.$on('groupDeleted', function(evt) {
    $scope.answerGroups = rulesService.getAnswerGroups();
    $scope.defaultOutcome = rulesService.getDefaultOutcome();
    $scope.activeGroupIndex = rulesService.getActiveGroupIndex();
  });

  $scope.$on('groupSaved', function(evt) {
    $scope.answerGroups = rulesService.getAnswerGroups();
    $scope.defaultOutcome = rulesService.getDefaultOutcome();
    $scope.activeGroupIndex = rulesService.getActiveGroupIndex();
  });

  $scope.openAddRuleModal = function() {
    warningsData.clear();
    $rootScope.$broadcast('externalSave');

    $modal.open({
      templateUrl: 'modals/addRule',
      backdrop: true,
      controller: [
          '$scope', '$modalInstance', 'rulesService', 'editorContextService',
          function($scope, $modalInstance, rulesService, editorContextService) {
        $scope.tmpRule = {
          rule_type: null,
          inputs: {}
        };
        $scope.tmpOutcome = {
          dest: editorContextService.getActiveStateName(),
          feedback: [''],
          param_changes: []
        };

        $scope.isSelfLoopWithNoFeedback = function(tmpOutcome) {
          var hasFeedback = false;
          for (var i = 0; i < tmpOutcome.feedback.length; i++) {
            if (tmpOutcome.feedback[i]) {
              hasFeedback = true;
              break;
            }
          }

          return (
            tmpOutcome.dest === editorContextService.getActiveStateName() &&
            !hasFeedback);
        };

        $scope.addGroupForm = {};

        $scope.addNewResponse = function() {
          $scope.$broadcast('saveOutcomeDetails');
          $modalInstance.close({
            'tmpRule': $scope.tmpRule,
            'tmpOutcome': $scope.tmpOutcome
          });
        };

        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
          warningsData.clear();
        };
      }]
    }).result.then(function(result) {
      var tmpRule = result['tmpRule'];
      var tmpOutcome = result['tmpOutcome'];
      _answerGroupsMemento = angular.copy($scope.answerGroups);
      $scope.answerGroups.push({
        'rule_specs': [tmpRule],
        'outcome': tmpOutcome
      });
      rulesService.save(
        $scope.answerGroups, $scope.defaultOutcome);
      $scope.changeActiveGroupIndex($scope.answerGroups.length - 1);
    });
  };

  $scope.openTeachOppiaModal = function() {
    $modal.open({
      templateUrl: 'modals/teachOppia',
      backdrop: true,
      controller: ['$scope', '$modalInstance', 'trainingDataService',
        'explorationStatesService', 'editorContextService',
        'answerClassificationService',
        function($scope, $modalInstance, trainingDataService,
            explorationStatesService, editorContextService,
            answerClassificationService) {
          $scope.trainingData = [];
          $scope.allFeedback = [];
          $scope.classification = {feedbackIndex: 0};

          $scope.selectCurrentFeedback = function() {
            console.log('Selecting feedback: ' +
              $scope.allFeedback[$scope.classification.feedbackIndex]);
          };

          var setFeedbackIndexForTrainingData = function(trainingDataIndex) {
            var index = -1;
            var trainingData = $scope.trainingData[trainingDataIndex];
            var trainedFeedback = trainingData.feedback;
            for (var i = 0; i < $scope.allFeedback.length; i++) {
              if ($scope.allFeedback[i] == trainedFeedback) {
                index = i;
                break;
              }
            }
            if (index != -1) {
              $scope.classification.feedbackIndex = index;
            }
          };

          $scope.finishTraining = function() {
            $modalInstance.close({
            });
          };

          // TODO(bhenning): This should be provided by a service.
          var explorationId = '';
          var pathnameArray = window.location.pathname.split('/');
          for (var i = 0; i < pathnameArray.length; i++) {
            if (pathnameArray[i] === 'create') {
              var explorationId = pathnameArray[i + 1];
              break;
            }
          }

          var currentStateName = editorContextService.getActiveStateName();
          var state = explorationStatesService.getState(currentStateName);

          $scope.allFeedback = trainingDataService.getAllPotentialFeedback(
            state);

          var trainingDataResult = trainingDataService.getTrainingDataResult(
            explorationId, currentStateName, state);

          trainingDataResult.success(function(result) {
            var unhandledAnswers = result['unhandled_answers'];

            answerClassificationService.getMatchingBatchClassificationResult(
              explorationId, state, unhandledAnswers).success(
                  function(classification_results) {
                for (var i = 0; i < classification_results.length; i++) {
                  var classification_result = classification_results[i];
                  var feedback = 'Nothing';
                  if (classification_result.outcome.feedback.length > 0) {
                    feedback = classification_result.outcome.feedback[0];
                  }
                  $scope.trainingData.push({
                    answer: unhandledAnswers[i],
                    feedback: feedback
                  });
                }

                setFeedbackIndexForTrainingData(0);
              });
          });
        }]
    }).result.then(function(result) {
      console.log('Finished teaching Oppia');
    });
  };

  $scope.ANSWER_GROUP_LIST_SORTABLE_OPTIONS = {
    axis: 'y',
    cursor: 'move',
    handle: '.oppia-rule-sort-handle',
    items: '.oppia-sortable-rule-block',
    tolerance: 'pointer',
    start: function(e, ui) {
      $rootScope.$broadcast('externalSave');
      $scope.$apply();
      ui.placeholder.height(ui.item.height());
    },
    stop: function(e, ui) {
      $scope.$apply();
      rulesService.save(
        $scope.answerGroups, $scope.defaultOutcome);
      $scope.changeActiveGroupIndex(ui.item.index());
      $rootScope.$broadcast('externalSave');
    }
  };

  $scope.deleteGroup = function(index) {
    var successfullyDeleted = rulesService.deleteGroup(index);
    if (successfullyDeleted) {
      $rootScope.$broadcast('groupDeleted');
    }
  };

  $scope.saveActiveGroup = function(updatedRules, updatedOutcome) {
    rulesService.saveActiveGroup(updatedRules, updatedOutcome);
    $rootScope.$broadcast('groupSaved');
  };

  $scope.saveDefaultOutcome = function(updatedOutcome) {
    rulesService.saveDefaultOutcome(updatedOutcome);
    $rootScope.$broadcast('groupSaved');
  };

  $scope.doesOutcomeHaveFeedback = function(outcome) {
    var feedback = outcome.feedback;
    return feedback.length > 0 && feedback[0].length > 0;
  };

  $scope.navigateToState = function(stateName) {
    routerService.navigateToMainTab(stateName);
  };
}]);

// A service that, given an exploration ID and state name, determines all of the
// answers which do not have certain classification and are not currently used
// as part of an fuzzy rule training models.
oppia.factory('trainingDataService', [
    '$http', function($http) {

  return {
    // Returns a promise with the corresponding training data.
    getTrainingDataResult: function(explorationId, stateName, state) {
      var trainingDataUrl = '/createhandler/training_data/' + explorationId +
        '/' + encodeURIComponent(stateName);
      return $http.post(trainingDataUrl, {state: state});
    },

    getAllPotentialFeedback: function(state) {
      var feedback = [];
      var interaction = state.interaction;

      for (var i = 0; i < interaction.answer_groups.length; i++) {
        var outcome = interaction.answer_groups[i].outcome;
        feedback.push((outcome.feedback.length > 0) ? outcome.feedback[0] : '');
      }

      if (interaction.default_outcome) {
        var outcome = interaction.default_outcome;
        feedback.push((outcome.feedback.length > 0) ? outcome.feedback[0] : '');
      } else {
        feedback.push('');
      }

      return feedback;
    }
  };
}]);

oppia.directive('trainingPanel', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      answer: '=',
      answerFeedback: '=',
      classification: '=',
      allFeedback: '=',
      selectFeedback: '&',
    },
    templateUrl: 'teaching/trainingPanel',
    controller: [
      '$scope', function($scope) {
        $scope.changingFeedbackIndex = false;

        $scope.beginChangingFeedbackIndex = function() {
          $scope.changingFeedbackIndex = true;
        };

        $scope.confirmFeedbackIndex = function(index) {
          $scope.classification.feedbackIndex = index;
          $scope.selectFeedback();
        };
      }
    ]
  };
}]);
