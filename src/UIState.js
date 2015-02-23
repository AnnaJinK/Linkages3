/* flow */

var EDIT_STATES = {
  INITIAL: 0,
  GROUND: 1,
  POINT: 2,
  SEGMENT: 3,
  GROUND_POINT: 4,
  GROUND_GROUND: 5,
  GROUND_TRIANGLE_1: 6,
  GROUND_TRIANGLE_2: 7,
  DYNAMIC_TRIANGLE: 8,
  ROTARY_HOVER: 9,
  ROTARY_LAND: 10,
  ROTARY_SELECTED: 11,
};

var EDIT_INPUT = {
  POINT: 0,
  SEGMENT: 1,
  SPACE: 2,
  ROTARY: 3,
};

var EDIT_STATE_TRANSITIONS = {
  [EDIT_STATES.INITIAL]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.POINT,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.SEGMENT, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.GROUND,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.ROTARY_SELECTED,
  },
  [EDIT_STATES.POINT]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.SEGMENT,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.INITIAL, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.GROUND_POINT,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.SEGMENT]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.INITIAL,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.SEGMENT, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.DYNAMIC_TRIANGLE,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.GROUND]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.INITIAL,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.INITIAL,
    [EDIT_INPUT.SPACE]: EDIT_STATES.GROUND_GROUND,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.GROUND_POINT]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.DYNAMIC_TRIANGLE,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.INITIAL, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.GROUND_TRIANGLE_1,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.GROUND_GROUND]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.GROUND_TRIANGLE_2,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.INITIAL, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.INITIAL,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.ROTARY_HOVER]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.INITIAL,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.INITIAL, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.ROTARY_LAND,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.INITIAL,
  },
  [EDIT_STATES.ROTARY_SELECTED]: {
    [EDIT_INPUT.POINT]: EDIT_STATES.POINT,
    [EDIT_INPUT.SEGMENT]: EDIT_STATES.SEGMENT, 
    [EDIT_INPUT.SPACE]: EDIT_STATES.GROUND,
    [EDIT_INPUT.ROTARY]: EDIT_STATES.ROTARY_SELECTED,
  },
};

module.exports = {
  EDIT_STATES,
  EDIT_INPUT,
  EDIT_STATE_TRANSITIONS,
};
