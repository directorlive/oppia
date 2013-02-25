// Copyright 2012 Google Inc. All Rights Reserved.
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
 * @fileoverview Angular controllers for the interactive widget preview in the GuiEditor.
 *
 * @author sll@google.com (Sean Lip)
 */

function InteractiveWidgetPreview($scope, $http, $compile, warningsData, explorationData) {
  var data = explorationData.getStateData($scope.stateId);

  $scope.initInteractiveWidget = function(data) {
    // Stores rules in the form of key-value pairs. For each pair, the key is the corresponding
    // action and the value has several keys:
    // - 'rule' (the raw rule string)
    // - 'inputs' (a list of parameters)
    // - 'attrs' (stuff needed to build the Python classifier code)
    // - 'dest' (the destination for this rule)
    // - 'feedback' (any feedback given for this rule)
    // - 'paramChanges' (parameter changes associated with this rule)
    $scope.interactiveRulesets = data.widget.rules;
    $scope.interactiveParams = data.widget.params;
    $http.get('/interactive_widgets/' + data.widget.id).success(
      function(widgetData) {
        $scope.addContentToIframe('interactiveWidgetPreview', widgetData.widget.raw);
        $scope.interactiveWidget = widgetData.widget;
      }
    );
  };

  if (data) {
    $scope.initInteractiveWidget(data);
  }

  $scope.getStateName = function(stateId) {
    return (stateId === END_DEST ? END_DEST : $scope.states[stateId].name);
  };

  $scope.getAllStates = function() {
    var allStates = [];
    for (var state in $scope.states) {
      allStates.push(state);
    }
    allStates.push(END_DEST);
    return allStates;
  };

  $scope.selectRule = function(rule, attrs) {
    $scope.deselectAllRules();
    $scope.addRuleActionRule = rule;
    $scope.addRuleActionAttrs = attrs;
    $scope.addRuleActionDest = explorationData.stateId;
  };

  $scope.deselectAllRules = function() {
    $scope.addRuleActionIndex = null;
    $scope.addRuleActionRule = null;
    $scope.addRuleActionAttrs = null;
    $scope.addRuleActionInputs = {};
    $scope.addRuleActionDest = null;
    $scope.addRuleActionFeedback = null;
  };

  $scope.openAddRuleModal = function(action) {
    $scope.addRuleModalTitle = 'Add Rule';
    $scope.addRuleAction = action;
    $scope.addRuleActionIndex = null;
  };

  $scope.openEditRuleModal = function(action, index) {
    $scope.addRuleModalTitle = 'Edit Rule';
    $scope.addRuleAction = action;

    $scope.addRuleActionIndex = index;
    var rule = $scope.interactiveRulesets[action][index];
    $scope.addRuleActionRule = rule.rule;
    $scope.addRuleActionAttrs = rule.attrs;
    $scope.addRuleActionInputs = rule.inputs;
    $scope.addRuleActionDest = rule.dest;
    $scope.addRuleActionFeedback = rule.feedback;
  };

  $('#addRuleModal').on('hide', function() {
    if ($scope.addRuleActionRule) {
      var bad = false;
      // TODO(sll): Do error-checking here.

      if (!bad) {
        var finalRuleset = {
            rule: $scope.addRuleActionRule,
            attrs: $scope.addRuleActionAttrs,
            inputs: $scope.addRuleActionInputs,
            dest: $scope.addRuleActionDest,
            feedback: $scope.addRuleActionFeedback
        };

        if (!$scope.interactiveRulesets.hasOwnProperty($scope.addRuleAction)) {
          $scope.interactiveRulesets[$scope.addRuleAction] = [];
        }

        var rules = $scope.interactiveRulesets[$scope.addRuleAction];

        if ($scope.addRuleActionIndex !== null) {
          rules[$scope.addRuleActionIndex] = finalRuleset;
        } else {
          rules.splice(rules.length - 1, 0, finalRuleset);
        }
        $scope.saveInteractiveWidget();
      }
    }

    $scope.addRuleAction = null;
    $scope.deselectAllRules();
  });

  $scope.swapRules = function(action, index1, index2) {
    $scope.tmpRule = $scope.interactiveRulesets[action][index1];
    $scope.interactiveRulesets[action][index1] =
        $scope.interactiveRulesets[action][index2];
    $scope.interactiveRulesets[action][index2] = $scope.tmpRule;

    $scope.saveInteractiveWidget();
  };

  $scope.deleteRule = function(action, index) {
    $scope.interactiveRulesets[action].splice(index, 1);
    $scope.saveInteractiveWidget();
  };

  $scope.convertDestToId = function(destName) {
    if (!destName) {
      warningsData.addWarning('Please choose a destination.');
      return;
    }

    var destId = '';

    var found = false;
    if (destName.toUpperCase() == END_DEST) {
      found = true;
      destId = END_DEST;
    } else {
      // Find the id in states.
      for (var id in $scope.states) {
        if ($scope.states[id].name == destName) {
          found = true;
          destId = id;
          break;
        }
      }
    }

    // TODO(sll): Add the following code, which triggers when the dest id
    // doesn't exist.
    // if (!found) {
    //   $scope.addState(destName, true, categoryId);
    //   return;
    // }

    if (!found) {
      warningsData.addWarning('Invalid destination id.');
      return destName + '(INVALID)';
    }

    return destId;
  };

  $('#interactiveWidgetModal').on('hide', function() {
    // Reload the iframe.
    var F = $('#interactiveWidgetRepository');
    F[0].src = F[0].src;
  });

  // Receive messages from the widget repository.
  $scope.$on('message', function(event, arg) {
    $scope.addContentToIframe('interactiveWidgetPreview', arg.data.raw);
    $('#interactiveWidgetModal').modal('hide');
    console.log($scope.interactiveWidget);
    if ($scope.interactiveWidget.id != arg.data.widget.id) {
      $scope.interactiveWidget = arg.data.widget;
      $scope.interactiveParams = {};
      $scope.interactiveRulesets = {'submit': [{
          'rule': 'Default',
          'attrs': {},
          'inputs': {},
          'dest': $scope.stateId,
          'feedback': '',
          'paramChanges': []
      }]};
    }
    $scope.saveInteractiveWidget();
  });

  $scope.saveInteractiveWidget = function() {
    explorationData.saveStateData($scope.stateId, {
        // The backend actually just saves the id of the widget.
        'interactive_widget': $scope.interactiveWidget.id,
        'interactive_params': $scope.interactiveParams,
        'interactive_rulesets': $scope.interactiveRulesets
    });
  };
}

InteractiveWidgetPreview.$inject = ['$scope', '$http', '$compile', 'warningsData', 'explorationData'];