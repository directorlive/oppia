# coding: utf-8
#
# Copyright 2014 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS-IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

__author__ = 'Sean Lip'

from core.domain import exp_domain
from core.domain import exp_services
from core.domain import event_services
from core.domain import stats_domain
from core.tests import test_utils
import feconf


class StateRuleAnswerLogUnitTests(test_utils.GenericTestBase):
    """Test the state rule answer log domain object."""

    DEFAULT_RULESPEC_STR = exp_domain.DEFAULT_RULESPEC_STR
    DEFAULT_RULESPEC = exp_domain.RuleSpec.get_default_rule_spec(
        'sid', 'NormalizedString')
    SUBMIT_HANDLER = feconf.SUBMIT_HANDLER_NAME

    def test_state_rule_answer_logs(self):
        exp = exp_domain.Exploration.create_default_exploration(
            'eid', 'title', 'category')
        exp_services.save_new_exploration('user_id', exp)

        state_name = exp.init_state_name

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {})
        self.assertEquals(answer_log.total_answer_count, 0)
        self.assertEquals(answer_log.get_top_answers(2), [])

        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER,
            self.DEFAULT_RULESPEC, 'answer1')

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {'answer1': 1})
        self.assertEquals(answer_log.total_answer_count, 1)
        self.assertEquals(answer_log.get_top_answers(1), [('answer1', 1)])
        self.assertEquals(answer_log.get_top_answers(2), [('answer1', 1)])

        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER,
            self.DEFAULT_RULESPEC, 'answer1')
        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC,
            'answer2')

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {'answer1': 2, 'answer2': 1})
        self.assertEquals(answer_log.total_answer_count, 3)
        self.assertEquals(
            answer_log.get_top_answers(1), [('answer1', 2)])
        self.assertEquals(
            answer_log.get_top_answers(2), [('answer1', 2), ('answer2', 1)])

        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC,
            'answer2')
        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC,
            'answer2')

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {'answer1': 2, 'answer2': 3})
        self.assertEquals(answer_log.total_answer_count, 5)
        self.assertEquals(
            answer_log.get_top_answers(1), [('answer2', 3)])
        self.assertEquals(
            answer_log.get_top_answers(2), [('answer2', 3), ('answer1', 2)])

    def test_recording_answer_for_different_rules(self):
        exp = exp_domain.Exploration.create_default_exploration(
            'eid', 'title', 'category')
        exp_services.save_new_exploration('user_id', exp)

        rule = exp_domain.RuleSpec.from_dict_and_obj_type({
            'definition':  {
                 'rule_type': 'atomic',
                 'name': 'LessThan',
                 'subject': 'answer',
                 'inputs': {'x': 5}
             },
             'dest': 'dest',
             'feedback': None,
             'param_changes': []
        }, 'Real')

        state_name = exp.init_state_name

        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC,
            'answer1')
        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER, rule,
            'answer2')

        default_rule_answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(default_rule_answer_log.answers, {'answer1': 1})
        self.assertEquals(default_rule_answer_log.total_answer_count, 1)

        other_rule_answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, str(rule))
        self.assertEquals(other_rule_answer_log.answers, {'answer2': 1})
        self.assertEquals(other_rule_answer_log.total_answer_count, 1)

    def test_resolving_answers(self):
        exp = exp_domain.Exploration.create_default_exploration(
            'eid', 'title', 'category')
        exp_services.save_new_exploration('user_id', exp)

        state_name = exp.init_state_name

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {})

        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER,
            self.DEFAULT_RULESPEC, 'answer1')
        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER,
            self.DEFAULT_RULESPEC, 'answer1')
        event_services.AnswerSubmissionEventHandler.record(
            'eid', 1, state_name, self.SUBMIT_HANDLER,
            self.DEFAULT_RULESPEC, 'answer2')

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {'answer1': 2, 'answer2': 1})
        self.assertEquals(answer_log.total_answer_count, 3)

        event_services.DefaultRuleAnswerResolutionEventHandler.record(
            'eid', state_name, self.SUBMIT_HANDLER, ['answer1'])

        answer_log = stats_domain.StateRuleAnswerLog.get(
            'eid', state_name, self.SUBMIT_HANDLER, self.DEFAULT_RULESPEC_STR)
        self.assertEquals(answer_log.answers, {'answer2': 1})
        self.assertEquals(answer_log.total_answer_count, 1)
