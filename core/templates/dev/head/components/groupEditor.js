// Copyright 2015 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Directive for the group, feedback, and outcome editors.
 *
 * @author bhenning@google.com (Ben Henning)
 */

oppia.directive('groupEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      rules: '=',
      outcome: '=',
      saveGroup: '&',
      isEditable: '='
    },
    templateUrl: 'inline/group_editor',
    controller: [
      '$scope', 'stateInteractionIdService', 'rulesService',
      'editorContextService', 'routerService', 'INTERACTION_SPECS',
      function(
        $scope, stateInteractionIdService, rulesService, editorContextService,
        routerService, INTERACTION_SPECS) {

    var resetMementos = function() {
      $scope.rulesMemento = null;
      $scope.outcomeFeedbackMemento = null;
      $scope.outcomeDestMemento = null;
    };
    resetMementos();

    $scope.groupEditorIsOpen = false;
    $scope.activeRuleIndex = -1;
    $scope.editGroupForm = {};

    $scope.getAnswerChoices = function() {
      return rulesService.getAnswerChoices();
    };
    $scope.answerChoices = $scope.getAnswerChoices();

    // Updates answer choices when the interaction requires it -- for example,
    // the rules for multiple choice need to refer to the multiple choice
    // interaction's customization arguments.
    // TODO(sll): Remove the need for this watcher, or make it less ad hoc.
    $scope.$on('updateAnswerChoices', function(evt, newAnswerChoices) {
      rulesService.updateAnswerChoices(newAnswerChoices);
      $scope.answerChoices = $scope.getAnswerChoices();
    });

    $scope.getCurrentInteractionId = function() {
      return stateInteractionIdService.savedMemento;
    };

    $scope.openGroupEditor = function() {
      if ($scope.isEditable) {
        $scope.rulesMemento = angular.copy($scope.rules);
        $scope.outcomeFeedbackMemento = angular.copy($scope.outcome.feedback);
        $scope.outcomeDestMemento = angular.copy($scope.outcome.dest);

        $scope.groupEditorIsOpen = true;
        if ($scope.outcome.feedback.length === 0) {
          $scope.outcome.feedback.push('');
        }
      }
    };

    $scope.saveThisGroup = function() {
      $scope.$broadcast('saveOutcomeDetails');
      // TODO(sll): Add more validation prior to saving.
      $scope.groupEditorIsOpen = false;
      resetMementos();
      $scope.saveGroup();
    };

    $scope.cancelThisEdit = function() {
      $scope.rules = angular.copy($scope.rulesMemento);
      $scope.outcome.feedback = angular.copy($scope.outcomeFeedbackMemento);
      $scope.outcome.dest = angular.copy($scope.outcomeDestMemento);
      resetMementos();
      $scope.changeActiveRuleIndex(-1);

      // Last step is to actually close the editor (to avoid other functions,
      // such as changeActiveRuleIndex from trying to reopen the editor).
      $scope.groupEditorIsOpen = false;
    };

    $scope.$on('externalSave', function() {
      if ($scope.groupEditorIsOpen) {
        $scope.saveThisGroup();
      }
    });

    var getDefaultInputValue = function(varType) {
      // TODO(bhenning): Typed objects should be required to provide a default
      // value specific to their type.
      switch (varType) {
        default:
        case 'Null':
          return null;
        case 'Boolean':
          return false;
        case 'Real':
        case 'Int':
        case 'NonnegativeInt':
          return 0;
        case 'UnicodeString':
        case 'NormalizedString':
        case 'MathLatexString':
        case 'Html':
        case 'SanitizedUrl':
        case 'Filepath':
        case 'LogicErrorCategory':
          return '';
        case 'CodeEvaluation':
          return {
            'code': getDefaultInputValue('UnicodeString'),
            'output': getDefaultInputValue('UnicodeString'),
            'evaluation': getDefaultInputValue('UnicodeString'),
            'error': getDefaultInputValue('UnicodeString')
          };
        case 'CoordTwoDim':
          return [getDefaultInputValue('Real'), getDefaultInputValue('Real')];
        case 'ListOfUnicodeString':
        case 'SetOfUnicodeString':
        case 'MusicPhrase':
          return [];
        case 'CheckedProof':
          return {
            'assumptions_string': getDefaultInputValue('UnicodeString'),
            'target_string': getDefaultInputValue('UnicodeString'),
            'proof_string': getDefaultInputValue('UnicodeString'),
            'correct': getDefaultInputValue('Boolean')
          };
        case 'LogicQuestion':
          return {
            'top_kind_name': getDefaultInputValue('UnicodeString'),
            'top_operator_name': getDefaultInputValue('UnicodeString'),
            'arguments': [],
            'dummies': []
          };
        case 'Graph':
          return {
            'vertices': [],
            'edges': [],
            'isLabeled': getDefaultInputValue('Boolean'),
            'isDirected': getDefaultInputValue('Boolean'),
            'isWeighted': getDefaultInputValue('Boolean')
          };
        case 'NormalizedRectangle2D':
          return [
            [getDefaultInputValue('Real'), getDefaultInputValue('Real')],
            [getDefaultInputValue('Real'), getDefaultInputValue('Real')]];
        case 'ImageRegion':
          return {
            'regionType': getDefaultInputValue('UnicodeString'),
            'area': getDefaultInputValue('NormalizedRectangle2D')
          };
        case 'ImageWithRegions':
          return {
            'imagePath': getDefaultInputValue('Filepath'),
            'labeledRegions': []
          };
        case 'ClickOnImage':
          return {
            'clickPosition': [
              getDefaultInputValue('Real'), getDefaultInputValue('Real')],
            'clickedRegions': []
          };
      }
    };

    $scope.addNewRule = function() {
      if (!$scope.groupEditorIsOpen) {
        $scope.openGroupEditor();
      }

      // Build an initial blank set of inputs for the initial rule.
      var interactionId = $scope.getCurrentInteractionId();
      var ruleDescriptions = INTERACTION_SPECS[interactionId].rule_descriptions;
      var ruleType = Object.keys(ruleDescriptions)[0];
      var description = ruleDescriptions[ruleType];

      var PATTERN = /\{\{\s*(\w+)\s*(\|\s*\w+\s*)?\}\}/;
      var inputs = {};
      while (description.match(PATTERN)) {
        var varName = description.match(PATTERN)[1];
        var varType = description.match(PATTERN)[2];
        if (varType) {
          varType = varType.substring(1);
        }

        inputs[varName] = getDefaultInputValue(varType);
        description = description.replace(PATTERN, ' ');
      }

      // TODO(bhenning): Should use functionality in ruleEditor.js, but move it
      // to rulesService in StateRules.js to properly form a new rule.
      $scope.rules.push({
        'rule_type': ruleType,
        'inputs': inputs,
      });
      $scope.changeActiveRuleIndex($scope.rules.length - 1);
    };

    $scope.deleteRule = function(index) {
      if (!$scope.groupEditorIsOpen) {
        $scope.openGroupEditor();
      }

      $scope.rules.splice(index, 1);
      $scope.changeActiveRuleIndex(0);
    };

    $scope.changeActiveRuleIndex = function(newIndex) {
      if (!$scope.groupEditorIsOpen) {
        $scope.openGroupEditor();
      }

      rulesService.changeActiveRuleIndex(newIndex);
      $scope.activeRuleIndex = rulesService.getActiveRuleIndex();
    };

    $scope.isSelfLoopWithNoFeedback = function(outcome) {
      var hasFeedback = false;
      for (var i = 0; i < outcome.feedback.length; i++) {
        if (outcome.feedback[i]) {
          hasFeedback = true;
          break;
        }
      }

      return (
        outcome.dest === editorContextService.getActiveStateName() &&
        !hasFeedback);
    };

    $scope.navigateToOutcomeDest = function() {
      routerService.navigateToMainTab($scope.outcome.dest);
    };

    $scope.isOutcomeConfusing = function() {
      return (
        $scope.outcome &&
        $scope.outcome.feedback.length === 0 &&
        $scope.outcome.dest === editorContextService.getActiveStateName());
    };

    $scope.RULE_LIST_SORTABLE_OPTIONS = {
      axis: 'y',
      cursor: 'move',
      handle: '.oppia-rule-sort-handle',
      items: '.oppia-sortable-rule-block',
      tolerance: 'pointer',
      start: function(e, ui) {
        if (!$scope.groupEditorIsOpen) {
          $scope.openGroupEditor();
        }
        $scope.$apply();
        ui.placeholder.height(ui.item.height());
      },
      stop: function(e, ui) {
        if (!$scope.groupEditorIsOpen) {
          $scope.openGroupEditor();
        }
        $scope.$apply();
        $scope.changeActiveRuleIndex(ui.item.index());
      }
    };

    $scope.$on('onInteractionIdChanged', function(evt, newInteractionId) {
      if ($scope.groupEditorIsOpen) {
        $scope.saveThisGroup();
      }
      $scope.$broadcast('updateAnswerGroupInteractionId');
      $scope.answerChoices = $scope.getAnswerChoices();
    });
  }]};
}]);

oppia.directive('outcomeFeedbackEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      outcome: '=',
    },
    templateUrl: 'rules/outcomeFeedbackEditor',
    controller: [
      '$scope',
      function($scope) {
        $scope.OUTCOME_FEEDBACK_SCHEMA = {type: 'html'};

        $scope.$on('saveOutcomeDetails', function() {
          // Remove null feedback.
          var nonemptyFeedback = [];
          for (var i = 0; i < $scope.outcome.feedback.length; i++) {
            var feedback = $scope.outcome.feedback[i];
            if (feedback) {
              feedback = feedback.trim();
            }
            if (feedback) {
              nonemptyFeedback.push(feedback);
            }
          }
          $scope.outcome.feedback = nonemptyFeedback;
        });
      }
    ]
  };
}]);

oppia.directive('outcomeDestinationEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      outcome: '=',
    },
    templateUrl: 'rules/outcomeDestinationEditor',
    controller: [
      '$scope', 'editorContextService', 'explorationStatesService',
      'stateGraphArranger',
      function(
          $scope, editorContextService, explorationStatesService,
          stateGraphArranger) {
        // We use a slash because this character is forbidden in a state name.
        var _PLACEHOLDER_OUTCOME_DEST = '/';

        var lastSetRuleDest = $scope.outcome.dest;

        $scope.$on('saveOutcomeDetails', function() {
          // Create new state if specified.
          if ($scope.outcome.dest == _PLACEHOLDER_OUTCOME_DEST) {
            var newStateName = $scope.outcome.newStateName;
            $scope.outcome.dest = newStateName;
            lastSetRuleDest = newStateName;
            delete $scope.outcome['newStateName'];

            explorationStatesService.addState(newStateName, null);
          } else {
            lastSetRuleDest = $scope.outcome.dest;
          }
          $scope.reloadingDestinations = true;
        });

        $scope.isCreatingNewState = function(outcome) {
          return outcome.dest == _PLACEHOLDER_OUTCOME_DEST;
        };

        $scope.destChoices = [];
        $scope.$watch(explorationStatesService.getStates, function(newValue) {
          var _currentStateName = editorContextService.getActiveStateName();

          // This is a list of objects, each with an ID and name. These
          // represent all states, as well as an option to create a
          // new state.
          $scope.destChoices = [{
            id: _currentStateName,
            text: _currentStateName + ' ⟳'
          }];

          // Arrange the remaining states based on their order in the state graph.
          var lastComputedArrangement = stateGraphArranger.getLastComputedArrangement();
          var allStateNames = Object.keys(explorationStatesService.getStates());

          var maxDepth = 0;
          var maxOffset = 0;
          for (var stateName in lastComputedArrangement) {
            maxDepth = Math.max(
              maxDepth, lastComputedArrangement[stateName].depth);
            maxOffset = Math.max(
              maxOffset, lastComputedArrangement[stateName].offset);
          }

          // Higher scores come later.
          var allStateScores = {};
          var unarrangedStateCount = 0;
          for (var i = 0; i < allStateNames.length; i++) {
            var stateName = allStateNames[i];
            if (lastComputedArrangement.hasOwnProperty(stateName)) {
              allStateScores[stateName] = (
                lastComputedArrangement[stateName].depth * (maxOffset + 1) +
                lastComputedArrangement[stateName].offset);
            } else {
              // States that have just been added in the rule 'create new'
              // modal are not yet included as part of lastComputedArrangement,
              // so we account for them here.
              allStateScores[stateName] = (
                (maxDepth + 1) * (maxOffset + 1) + unarrangedStateCount);
              unarrangedStateCount++;
            }
          }

          var stateNames = allStateNames.sort(function(a, b) {
            return allStateScores[a] - allStateScores[b];
          });

          for (var i = 0; i < stateNames.length; i++) {
            if (stateNames[i] !== _currentStateName) {
              $scope.destChoices.push({
                id: stateNames[i],
                text: stateNames[i]
              });
            }
          }

          $scope.destChoices.push({
            id: _PLACEHOLDER_OUTCOME_DEST,
            text: 'A New Card Called...'
          });
        }, true);
      }
    ]
  };
}]);
