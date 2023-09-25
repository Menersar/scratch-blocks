/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2014 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @fileoverview Object representing a workspace rendered as SVG.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';
// Blockly.WorkspaceSvg.prototype.processProcedureReturnsChanged = function() {
/**
 * @private
 */
Blockly.WorkspaceSvg.prototype.processProcedureReturnsChanged_ = function () {
  var initialTypes = this.initialProcedureReturnTypes_;
  var finalTypes = Blockly.Procedures.getAllProcedureReturnTypes(this);

  this.initialProcedureReturnTypes_ = null;
  this.checkProcedureReturnAfterGesture_ = false;
  this.procedureReturnChangeTimeout_ = null;

  // !!! LOL? ???
  //   // Don't fire events for each block, instead batch them all together.
  //   // This is called after a gesture ends, or after a timeout (e.g. when
  //   // a procedure mutator is opened or closed).
  //   // This is necessary because the return type of a procedure call can
  //   // change when a procedure mutator is opened or closed, and we don't
  //   // want to fire events for each block in that case.
  //   // We also don't want to fire events for each block when a procedure
  //   // mutator is opened or closed because that would cause the toolbox
  //   // to refresh multiple times, which is slow.
  //   // Instead, we fire one event for all the blocks that changed.
  //   // This is also called when a procedure mutator is opened or closed,
  //   // because the return type of a procedure call can change when a
  //   // procedure mutator is opened or closed.
  //   // This is also called when a procedure definition is changed,
  //   // because the return type of a procedure call can change when a
  //   // procedure definition is changed.
  // Update shape of loose blocks when return types change.
  Blockly.Events.setGroup(true);
  var topBlocks = this.getTopBlocks(false);
  for (var i = 0; i < topBlocks.length; i++) {
    var block = topBlocks[i];
    // if (!block.getNextBlock() && block.type === Blockly.PROCEDURES_CALL_BLOCK_TYPE) {
    if (block.type !== Blockly.PROCEDURES_CALL_BLOCK_TYPE) continue;

    // !!! ???
    // After a gesture, call is early enough, so that:
    // There could still be insertion markers.
    if (block.isInsertionMarker()) continue;

    // Because this block is a top block:
    // It will not have a parent by definition.
    // If another block is connected below:
    // It should be left unchanged (instead of unplugging).
    if (block.getNextBlock()) continue;

    var procCode = block.getProcCode();
    // If the procedure does not exist or is new:
    // Ignore it.
    // (Fix procedure call type being lost when proccode changes.)
    if (!Object.prototype.hasOwnProperty.call(initialTypes, procCode) ||
      !Object.prototype.hasOwnProperty.call(finalTypes, procCode)) continue;

    // Allow custom boolean reporters.
    // var actuallyReturns = Blockly.Procedures.procedureContainsReturn(procCode, this);
    // if (actuallyReturns && block.getReturn() === Blockly.PROCEDURES_CALL_TYPE_STATEMENT) {
    //   Blockly.Procedures.changeReturnType(block, Blockly.PROCEDURES_CALL_TYPE_REPORTER);
    // } else if (!actuallyReturns && block.getReturn() !== Blockly.PROCEDURES_CALL_TYPE_STATEMENT) {
    //   Blockly.Procedures.changeReturnType(block, Blockly.PROCEDURES_CALL_TYPE_STATEMENT);
    // }
    // var actuallyReturns = Blockly.Procedures.procedureContainsReturnType(procCode, this);
    var actualReturnType = finalTypes[procCode];

    // if (actuallyReturns !== block.getReturn()) {
    if (block.getReturn() !== actualReturnType &&
      // actuallyReturns !== block.getReturn()
      // If a user is allowed to override call block shape:
      // Only update the shape if:
      // The definition's shape has actually changed.
      (!Blockly.Procedures.USER_CAN_CHANGE_CALL_TYPE || initialTypes[procCode] !== actualReturnType)) {
      // Blockly.Procedures.changeReturnType(block, actuallyReturns);
      Blockly.Procedures.changeReturnType(block, actualReturnType);
    }

    // }
  }
  Blockly.Events.setGroup(false);

  // Toolbox refresh can be slow, thus:
  // Only perform toolbox refresh when needed.
  var toolboxOutdated = false;
  for (var procCode in finalTypes) {
    // If a current procedure existed but its type has changed:
    // The toolbox must be updated.
    // If a new procedure was created:
    // The toolbox is already updated elsewhere.
    if (Object.prototype.hasOwnProperty.call(initialTypes, procCode) &&
      initialTypes[procCode] !== finalTypes[procCode]) {
      toolboxOutdated = true;
      break;
    }
  }
  if (toolboxOutdated) {
    this.refreshToolboxSelection_();
  }
};
