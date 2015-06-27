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
 * @fileoverview Directive for the rule editor.
 *
 * @author sll@google.com (Sean Lip)
 */

oppia.directive('ruleTypeSelector', [function() {
  return {
    restrict: 'E',
    scope: {
      localValue: '=',
      onSelectionChange: '&'
    },
    template: '<input type="hidden">',
    controller: [
        '$scope', '$element', '$rootScope', '$filter', 'stateInteractionIdService', 'INTERACTION_SPECS',
        function($scope, $element, $rootScope, $filter, stateInteractionIdService, INTERACTION_SPECS) {

      var choices = [];
      var numberOfRuleTypes = 0;

      var ruleTypesToDescriptions = INTERACTION_SPECS[
        stateInteractionIdService.savedMemento].rule_descriptions;
      for (var ruleType in ruleTypesToDescriptions) {
        numberOfRuleTypes++;
        choices.push({
          id: ruleType,
          text: $filter('replaceInputsWithEllipses')(
            ruleTypesToDescriptions[ruleType])
        });
      }

      // TODO(bhenning): The order of choices should be meaningful. E.g., having
      // "is equal to" for most interactions first makes sense. They should
      // ideally be ordered based on likelihood of being used.
      choices.sort(function(a, b) {
        if (a.text < b.text) {
          return -1;
        } else if (a.text > b.text) {
          return 1;
        } else {
          return 0;
        }
      });

      // Select the first choice by default.
      if (!$scope.localValue) {
        $scope.localValue = choices[0].id;
        $scope.onSelectionChange()($scope.localValue);
      }

      var select2Node = $element[0].firstChild;
      $(select2Node).select2({
        data: choices,
        // Suppress the search box.
        minimumResultsForSearch: -1,
        allowClear: false,
        width: '350px',
        formatSelection: function(object, container) {
          if (object.id === 'Default') {
            return (
              stateInteractionIdService.savedMemento === 'Continue' ?
              'is clicked...' :
              'is anything else...');
          } else {
            return $filter('truncateAtFirstEllipsis')(object.text);
          }
        }
      });

      // Initialize the dropdown.
      $(select2Node).select2('val', $scope.localValue);

      // Update $scope.localValue when the selection changes.
      $(select2Node).on('change', function(e) {
        $scope.localValue = e.val;
        // This is needed to actually update the localValue in the containing
        // scope.
        $scope.$apply();
        $scope.onSelectionChange()(e.val);
        // This is needed to propagate the change and display input fields for
        // parameterizing the rule.
        $scope.$apply();
      });
    }]
  };
}]);


oppia.directive('ruleEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      rule: '=',
      isDefaultRule: '&',
      saveRule: '&',
      deleteRule: '&',
      isEditable: '='
    },
    templateUrl: 'inline/rule_editor',
    controller: [
      '$scope', '$rootScope', '$modal', '$timeout', 'editorContextService', 'routerService',
      'validatorsService', 'rulesService', 'explorationStatesService', 'stateInteractionIdService',
      function(
          $scope, $rootScope, $modal, $timeout, editorContextService, routerService,
          validatorsService, rulesService, explorationStatesService, stateInteractionIdService) {
        $scope.editRuleForm = {};

        $scope.answerChoices = rulesService.getAnswerChoices();
        $scope.currentInteractionId = stateInteractionIdService.savedMemento;

        var resetMementos = function() {
          $scope.ruleTypeMemento = null;
          $scope.ruleInputsMemento = null;
        };
        resetMementos();

        $scope.ruleEditorIsOpen = false;
        $scope.openRuleEditor = function() {
          if ($scope.isEditable) {
            if (!$scope.isDefaultRule()) {
              $scope.ruleTypeMemento = angular.copy($scope.rule.rule_type);
              $scope.ruleInputsMemento = angular.copy($scope.rule.inputs);
            } else {
              $scope.ruleTypeMemento = null;
              $scope.ruleInputsMemento = null;
            }

            $scope.ruleEditorIsOpen = true;
          }
        };

        $scope.$on('onInteractionIdChanged', function(evt, newInteractionId) {
          if ($scope.ruleEditorIsOpen) {
            $scope.saveThisRule();
          }
          $scope.$broadcast('updateRuleDescriptionInteractionId');
        });

        $scope.getActiveStateName = function() {
          return editorContextService.getActiveStateName();
        };
      }
    ]
  };
}]);


oppia.directive('ruleDetailsEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      rule: '=',
      isDefaultRule: '&'
    },
    templateUrl: 'rules/ruleDetailsEditor',
    controller: [
      '$scope', 'stateInteractionIdService',
      function($scope, stateInteractionIdService) {
        $scope.currentInteractionId = stateInteractionIdService.savedMemento;
      }
    ]
  };
}]);


oppia.directive('ruleDescriptionEditor', ['$log', function($log) {
  return {
    restrict: 'E',
    scope: {
      currentRule: '=',
      isDefaultRule: '&'
    },
    templateUrl: 'rules/ruleDescriptionEditor',
    controller: [
        '$scope', 'editorContextService', 'explorationStatesService', 'routerService', 'validatorsService',
        'rulesService', 'stateInteractionIdService', 'INTERACTION_SPECS',
        function($scope, editorContextService, explorationStatesService, routerService, validatorsService,
                 rulesService, stateInteractionIdService, INTERACTION_SPECS) {

      $scope.currentInteractionId = stateInteractionIdService.savedMemento;

      // This returns the rule description string.
      var _computeRuleDescriptionFragments = function() {
        if (!$scope.currentRule.rule_type) {
          $scope.ruleDescriptionFragments = [];
          return '';
        }

        var ruleDescription = INTERACTION_SPECS[
          $scope.currentInteractionId].rule_descriptions[$scope.currentRule.rule_type];

        var PATTERN = /\{\{\s*(\w+)\s*\|\s*(\w+)\s*\}\}/;
        var finalInputArray = ruleDescription.split(PATTERN);
        if (finalInputArray.length % 3 !== 1) {
          $log.error('Could not process rule description.');
        }

        var result = [];
        for (var i = 0; i < finalInputArray.length; i += 3) {
          result.push({
            type: 'noneditable',
            // Omit the leading noneditable string.
            text: i !== 0 ? finalInputArray[i] : ''
          });
          if (i == finalInputArray.length - 1) {
            break;
          }

          var _answerChoices = rulesService.getAnswerChoices();

          if (_answerChoices) {
            // This rule is for a multiple-choice or image-click interaction.
            // TODO(sll): Remove the need for this special case.
            if (_answerChoices.length > 0) {
              $scope.ruleDescriptionChoices = _answerChoices.map(function(choice, ind) {
                return {
                  val: choice.label,
                  id: choice.val
                };
              });
              result.push({'type': 'select', 'varName': finalInputArray[i+1]});
              if (!$scope.currentRule.inputs[finalInputArray[i + 1]]) {
                $scope.currentRule.inputs[finalInputArray[i + 1]] = $scope.ruleDescriptionChoices[0].id;
              }
            } else {
              $scope.ruleDescriptionChoices = [];
              result.push({'type': 'noneditable', 'text': ' [Error: No choices available] '});
            }
          } else {
            result.push({
              'type': finalInputArray[i+2],
              'varName': finalInputArray[i+1]
            });
          }
        }
        $scope.ruleDescriptionFragments = result;
        return ruleDescription;
      };

      $scope.$on('updateRuleDescriptionInteractionId', function(evt, newInteractionId) {
        $scope.currentInteractionId = newInteractionId;
      });

      $scope.onSelectNewRuleType = function(newRuleType) {
        $scope.currentRule.rule_type = newRuleType;
        $scope.currentRule.inputs = {};
        var tmpRuleDescription = _computeRuleDescriptionFragments();

        // Finds the parameters and sets them in $scope.currentRule.inputs.
        var PATTERN = /\{\{\s*(\w+)\s*(\|\s*\w+\s*)?\}\}/;
        while (true) {
          if (!tmpRuleDescription.match(PATTERN)) {
            break;
          }
          var varName = tmpRuleDescription.match(PATTERN)[1];
          var varType = null;
          if (tmpRuleDescription.match(PATTERN)[2]) {
            varType = tmpRuleDescription.match(PATTERN)[2].substring(1);
          }

          if (varType == 'Set') {
            $scope.currentRule.inputs[varName] = [];
          } else if (varType == 'NonnegativeInt') {
            // Set a default value.
            $scope.currentRule.inputs[varName] = 0;
          } else if (varType == "Graph") {
            $scope.currentRule.inputs[varName] = {
              'vertices': [],
              'edges': [],
              'isDirected': false,
              'isWeighted': false,
              'isLabeled': false
            };
          } else {
            $scope.currentRule.inputs[varName] = '';
          }

          tmpRuleDescription = tmpRuleDescription.replace(PATTERN, ' ');
        }
      };

      $scope.init = function() {
        // Select a default rule type, if one isn't already selected.
        if (!$scope.isDefaultRule() && $scope.currentRule.rule_type === null) {
          var ruleTypesToDescriptions = INTERACTION_SPECS[$scope.currentInteractionId].rule_descriptions;
          for (var ruleType in ruleTypesToDescriptions) {
            if ($scope.currentRule.rule_type === null || ruleType < $scope.currentRule.rule_type) {
              $scope.currentRule.rule_type = ruleType;
            }
          }
          $scope.onSelectNewRuleType($scope.currentRule.rule_type);
        }

        _computeRuleDescriptionFragments();
      };

      $scope.init();
    }]
  };
}]);
