/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
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
 * @fileoverview Utility functions for handling procedures.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * @name Blockly.Procedures
 * @namespace
 **/
goog.provide('Blockly.Procedures');

goog.require('Blockly.Blocks');
goog.require('Blockly.constants');
goog.require('Blockly.Events.BlockChange');
goog.require('Blockly.Field');
goog.require('Blockly.Names');
goog.require('Blockly.Workspace');


/**
 * Constant to separate procedure names from variables and generated functions
 * when running generators.
 * @deprecated Use Blockly.PROCEDURE_CATEGORY_NAME
 */
Blockly.Procedures.NAME_TYPE = Blockly.PROCEDURE_CATEGORY_NAME;

/**
 * Find all user-created procedure definitions in a workspace.
 * @param {!Blockly.Workspace} root Root workspace.
 * @return {!Array.<!Array.<!Array>>} Pair of arrays, the
 *     first contains procedures without return variables, the second with.
 *     Each procedure is defined by a three-element list of name, parameter
 *     list, and return value boolean.
 */
Blockly.Procedures.allProcedures = function(root) {
  var blocks = root.getAllBlocks();
  var proceduresReturn = [];
  var proceduresNoReturn = [];
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].getProcedureDef) {
      var tuple = blocks[i].getProcedureDef();
      if (tuple) {
        if (tuple[2]) {
          proceduresReturn.push(tuple);
        } else {
          proceduresNoReturn.push(tuple);
        }
      }
    }
  }
  proceduresNoReturn.sort(Blockly.Procedures.procTupleComparator_);
  proceduresReturn.sort(Blockly.Procedures.procTupleComparator_);
  return [proceduresNoReturn, proceduresReturn];
};

/**
 * Find all user-created procedure definition mutations in a workspace.
 * @param {!Blockly.Workspace} root Root workspace.
 * @return {!Array.<Element>} Array of mutation xml elements.
 * @package
 */
Blockly.Procedures.allProcedureMutations = function(root) {
  var blocks = root.getAllBlocks();
  var mutations = [];
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].type == Blockly.PROCEDURES_PROTOTYPE_BLOCK_TYPE) {
      var mutation = blocks[i].mutationToDom(/* opt_generateShadows */ true);
      if (mutation) {
        mutations.push(mutation);
      }
    }
  }
  return mutations;
};

/**
 * Sorts an array of procedure definition mutations alphabetically.
 * (Does not mutate the given array.)
 * @param {!Array.<Element>} mutations Array of mutation xml elements.
 * @return {!Array.<Element>} Sorted array of mutation xml elements.
 * @private
 */
Blockly.Procedures.sortProcedureMutations_ = function(mutations) {
  var newMutations = mutations.slice();

  newMutations.sort(function(a, b) {
    var procCodeA = a.getAttribute('proccode');
    var procCodeB = b.getAttribute('proccode');

    return Blockly.scratchBlocksUtils.compareStrings(procCodeA, procCodeB);
  });

  return newMutations;
};

/**
 * Comparison function for case-insensitive sorting of the first element of
 * a tuple.
 * @param {!Array} ta First tuple.
 * @param {!Array} tb Second tuple.
 * @return {number} -1, 0, or 1 to signify greater than, equality, or less than.
 * @private
 */
Blockly.Procedures.procTupleComparator_ = function(ta, tb) {
  return Blockly.scratchBlocksUtils.compareStrings(ta[0], tb[0]);
};

/**
 * Ensure two identically-named procedures don't exist.
 * @param {string} name Proposed procedure name.
 * @param {!Blockly.Block} block Block to disambiguate.
 * @return {string} Non-colliding name.
 */
Blockly.Procedures.findLegalName = function(name, block) {
  if (block.isInFlyout) {
    // Flyouts can have multiple procedures called 'do something'.
    return name;
  }
  while (!Blockly.Procedures.isLegalName_(name, block.workspace, block)) {
    // Collision with another procedure.
    var r = name.match(/^(.*?)(\d+)$/);
    if (!r) {
      name += '2';
    } else {
      name = r[1] + (parseInt(r[2], 10) + 1);
    }
  }
  return name;
};

/**
 * Does this procedure have a legal name?  Illegal names include names of
 * procedures already defined.
 * @param {string} name The questionable name.
 * @param {!Blockly.Workspace} workspace The workspace to scan for collisions.
 * @param {Blockly.Block=} opt_exclude Optional block to exclude from
 *     comparisons (one doesn't want to collide with oneself).
 * @return {boolean} True if the name is legal.
 * @private
 */
Blockly.Procedures.isLegalName_ = function(name, workspace, opt_exclude) {
  return !Blockly.Procedures.isNameUsed(name, workspace, opt_exclude);
};

/**
 * Return if the given name is already a procedure name.
 * @param {string} name The questionable name.
 * @param {!Blockly.Workspace} workspace The workspace to scan for collisions.
 * @param {Blockly.Block=} opt_exclude Optional block to exclude from
 *     comparisons (one doesn't want to collide with oneself).
 * @return {boolean} True if the name is used, otherwise return false.
 */
Blockly.Procedures.isNameUsed = function(name, workspace, opt_exclude) {
  var blocks = workspace.getAllBlocks();
  // Iterate through every block and check the name.
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i] == opt_exclude) {
      continue;
    }
    if (blocks[i].getProcedureDef) {
      var procName = blocks[i].getProcedureDef();
      if (Blockly.Names.equals(procName[0], name)) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Rename a procedure.  Called by the editable field.
 * @param {string} name The proposed new name.
 * @return {string} The accepted name.
 * @this {Blockly.Field}
 */
Blockly.Procedures.rename = function(name) {
  // Strip leading and trailing whitespace.  Beyond this, all names are legal.
  name = name.replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');

  // Ensure two identically-named procedures don't exist.
  var legalName = Blockly.Procedures.findLegalName(name, this.sourceBlock_);
  var oldName = this.text_;
  if (oldName != name && oldName != legalName) {
    // Rename any callers.
    var blocks = this.sourceBlock_.workspace.getAllBlocks();
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].renameProcedure) {
        blocks[i].renameProcedure(oldName, legalName);
      }
    }
  }
  return legalName;
};

/**
 * Construct the blocks required by the flyout for the procedure category.
 * @param {!Blockly.Workspace} workspace The workspace contianing procedures.
 * @return {!Array.<!Element>} Array of XML block elements.
 */
Blockly.Procedures.flyoutCategory = function(workspace) {
  var xmlList = [];

  Blockly.Procedures.addCreateButton_(workspace, xmlList);

  // Create call blocks for each procedure defined in the workspace
  var mutations = Blockly.Procedures.allProcedureMutations(workspace);
  mutations = Blockly.Procedures.sortProcedureMutations_(mutations);
  for (var i = 0; i < mutations.length; i++) {
    // var mutation = mutations[i];
    var mutation = mutations[i].cloneNode(false);
    var procCode = mutation.getAttribute('proccode');
    // // Allow custom boolean reporters.
    // // if (Blockly.Procedures.procedureContainsReturn(procCode, workspace)) {
    // eslint-disable-next-line max-len
    // if (Blockly.Procedures.procedureContainsReturnType(procCode, workspace) === Blockly.PROCEDURES_CALL_TYPE_REPORTER) {
    var returnType = Blockly.Procedures.getProcedureReturnType(procCode, workspace);

    //   mutation.setAttribute('return', Blockly.PROCEDURES_CALL_TYPE_REPORTER);

    // // Allow custom boolean reporters.
    // eslint-disable-next-line max-len
    // } else if (Blockly.Procedures.procedureContainsReturnType(procCode, workspace) === Blockly.PROCEDURES_CALL_TYPE_BOOLEAN) {
    //   mutation.setAttribute('return', Blockly.PROCEDURES_CALL_TYPE_BOOLEAN);
    // }
    if (returnType !== Blockly.PROCEDURES_CALL_TYPE_STATEMENT) {
      mutation.setAttribute('return', returnType);
    }
    // !!! Following lines, meaning of those, etc.(?!)? ???
    // <block type="procedures_call">
    //   <mutation ...></mutation>
    // </block>
    // Button explaining how to use 'return'.
    // (See also code line 'Blockly.Msg.PROCEDURES_DOCS = 'How to use return';' in file '../msg/messages.js'.)
    var block = goog.dom.createDom('block');
    block.setAttribute('type', 'procedures_call');
    block.setAttribute('gap', 16);
    block.appendChild(mutation);
    xmlList.push(block);
  }

  var showReturn = (
    Blockly.Procedures.DEFAULT_ENABLE_RETURNS ?
    mutations.length > 0 :
    workspace.procedureReturnsEnabled
  );
    
  // Do not show return block if no custom blocks exist.
  // var returnBlock = goog.dom.createDom('block');
  // returnBlock.setAttribute('type', 'procedures_return');
  // returnBlock.setAttribute('gap', 16);
  // var returnBlockValue = goog.dom.createDom('value');
  // returnBlockValue.setAttribute('name', 'VALUE');
  // var returnBlockShadow = goog.dom.createDom('shadow');
  // returnBlockShadow.setAttribute('type', 'text');
  // var returnBlockField = goog.dom.createDom('field');
  // returnBlockField.setAttribute('name', 'TEXT');
  // returnBlockShadow.appendChild(returnBlockField);
  // returnBlockValue.appendChild(returnBlockShadow);
  // returnBlock.appendChild(returnBlockValue);
  // xmlList.push(returnBlock);
  // if (mutations.length > 0) {
  if (showReturn) {
    var returnBlock = goog.dom.createDom('block');
    // returnBlock.setAttribute('type', 'procedures_return');
    returnBlock.setAttribute('type', Blockly.PROCEDURES_RETURN_BLOCK_TYPE);
    returnBlock.setAttribute('gap', 16);
    var returnBlockValue = goog.dom.createDom('value');
    returnBlockValue.setAttribute('name', 'VALUE');
    var returnBlockShadow = goog.dom.createDom('shadow');
    returnBlockShadow.setAttribute('type', 'text');
    var returnBlockField = goog.dom.createDom('field');
    returnBlockField.setAttribute('name', 'TEXT');
    returnBlockShadow.appendChild(returnBlockField);
    returnBlockValue.appendChild(returnBlockShadow);
    returnBlock.appendChild(returnBlockValue);

    // Move return block to the start of the list (instead of the end).
    // xmlList.push(returnBlock);
    // (Method 'unshift': Inserts new elements at start of an array; returns the new length of the array.)
    xmlList.unshift(returnBlock);

    var returnDocsButton = goog.dom.createDom('button');
    returnDocsButton.setAttribute('callbackkey', 'OPEN_RETURN_DOCS');
    returnDocsButton.setAttribute('text', Blockly.Msg.PROCEDURES_DOCS);
    xmlList.unshift(returnDocsButton);
  }

  return xmlList;
};

/**
 * Create the "Make a Block..." button.
 * @param {!Blockly.Workspace} workspace The workspace contianing procedures.
 * @param {!Array.<!Element>} xmlList Array of XML block elements to add to.
 * @private
 */
Blockly.Procedures.addCreateButton_ = function(workspace, xmlList) {
  var button = goog.dom.createDom('button');
  var msg = Blockly.Msg.NEW_PROCEDURE;
  var callbackKey = 'CREATE_PROCEDURE';
  var callback = function() {
    Blockly.Procedures.createProcedureDefCallback_(workspace);
  };
  button.setAttribute('text', msg);
  button.setAttribute('callbackKey', callbackKey);
  workspace.registerButtonCallback(callbackKey, callback);
  xmlList.push(button);
};

/**
 * Find all callers of a named procedure.
 * @param {string} name Name of procedure (procCode in scratch-blocks).
 * @param {!Blockly.Workspace} ws The workspace to find callers in.
 * @param {!Blockly.Block} definitionRoot The root of the stack where the
 *     procedure is defined.
 * @param {boolean} allowRecursive True if the search should include recursive
 *     procedure calls.  False if the search should ignore the stack starting
 *     with definitionRoot.
 * @return {!Array.<!Blockly.Block>} Array of caller blocks.
 * @package
 */
Blockly.Procedures.getCallers = function(name, ws, definitionRoot,
    allowRecursive) {
  var allBlocks = [];
  var topBlocks = ws.getTopBlocks();

  // Start by deciding which stacks to investigate.
  for (var i = 0; i < topBlocks.length; i++) {
    var block = topBlocks[i];
    if (block.id == definitionRoot.id && !allowRecursive) {
      continue;
    }
    allBlocks.push.apply(allBlocks, block.getDescendants(false));
  }

  var callers = [];
  for (var i = 0; i < allBlocks.length; i++) {
    var block = allBlocks[i];
    if (block.type == Blockly.PROCEDURES_CALL_BLOCK_TYPE ) {
      var procCode = block.getProcCode();
      if (procCode && procCode == name) {
        callers.push(block);
      }
    }
  }
  return callers;
};

/**
 * Find and edit all callers with a procCode using a new mutation.
 * @param {string} name Name of procedure (procCode in scratch-blocks).
 * @param {!Blockly.Workspace} ws The workspace to find callers in.
 * @param {!Element} mutation New mutation for the callers.
 * @package
 */
Blockly.Procedures.mutateCallersAndPrototype = function(name, ws, mutation) {
  var defineBlock = Blockly.Procedures.getDefineBlock(name, ws);
  var prototypeBlock = Blockly.Procedures.getPrototypeBlock(name, ws);
  if (defineBlock && prototypeBlock) {
    var callers = Blockly.Procedures.getCallers(name,
        defineBlock.workspace, defineBlock, true /* allowRecursive */);
    callers.push(prototypeBlock);
    Blockly.Events.setGroup(true);
    for (var i = 0, caller; caller = callers[i]; i++) {
      var oldMutationDom = caller.mutationToDom();
      var oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);

      // Fix Bug: Editing a procedure results in corrupted project.
      // caller.domToMutation(mutation);
      // Preserve the block's existing (/ present(?!)) shape.
      var mutationToReplaceWith = mutation.cloneNode(false);
      mutationToReplaceWith.setAttribute('return', oldMutationDom.getAttribute('return'));
      caller.domToMutation(mutationToReplaceWith);

      var newMutationDom = caller.mutationToDom();
      var newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);
      if (oldMutation != newMutation) {
        Blockly.Events.fire(new Blockly.Events.BlockChange(
            caller, 'mutation', null, oldMutation, newMutation));
      }
    }
    Blockly.Events.setGroup(false);
  } else {
    alert('No define block on workspace'); // TODO decide what to do about this.
  }
};

/**
 * Find the definition block for the named procedure.
 * @param {string} procCode The identifier of the procedure.
 * @param {!Blockly.Workspace} workspace The workspace to search.
 * @return {Blockly.Block} The procedure definition block, or null not found.
 * @package
 */
Blockly.Procedures.getDefineBlock = function(procCode, workspace) {
  // Assume that a procedure definition is a top block.
  var blocks = workspace.getTopBlocks(false);
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].type == Blockly.PROCEDURES_DEFINITION_BLOCK_TYPE) {
      var prototypeBlock = blocks[i].getInput('custom_block').connection.targetBlock();
      if (prototypeBlock.getProcCode && prototypeBlock.getProcCode() == procCode) {
        return blocks[i];
      }
    }
  }
  return null;
};

/**
 * Find the prototype block for the named procedure.
 * @param {string} procCode The identifier of the procedure.
 * @param {!Blockly.Workspace} workspace The workspace to search.
 * @return {Blockly.Block} The procedure prototype block, or null not found.
 * @package
 */
Blockly.Procedures.getPrototypeBlock = function(procCode, workspace) {
  var defineBlock = Blockly.Procedures.getDefineBlock(procCode, workspace);
  if (defineBlock) {
    return defineBlock.getInput('custom_block').connection.targetBlock();
  }
  return null;
};

/**
 * Create a mutation for a brand new custom procedure.
 * @return {Element} The mutation for a new custom procedure
 * @package
 */
Blockly.Procedures.newProcedureMutation = function() {
  var mutationText = '<xml>' +
      '<mutation' +
      ' proccode="' + Blockly.Msg['PROCEDURE_DEFAULT_NAME'] + '"' +
      ' argumentids="[]"' +
      ' argumentnames="[]"' +
      ' argumentdefaults="[]"' +
      ' warp="false">' +
      '</mutation>' +
      '</xml>';
  return Blockly.Xml.textToDom(mutationText).firstChild;
};

/**
 * Callback to create a new procedure custom command block.
 * @param {!Blockly.Workspace} workspace The workspace to create the new procedure on.
 * @private
 */
Blockly.Procedures.createProcedureDefCallback_ = function(workspace) {
  Blockly.Procedures.externalProcedureDefCallback(
      Blockly.Procedures.newProcedureMutation(),
      Blockly.Procedures.createProcedureCallbackFactory_(workspace)
  );
};

/**
 * Callback factory for adding a new custom procedure from a mutation.
 * @param {!Blockly.Workspace} workspace The workspace to create the new procedure on.
 * @return {function(?Element)} callback for creating the new custom procedure.
 * @private
 */
Blockly.Procedures.createProcedureCallbackFactory_ = function(workspace) {
  return function(mutation) {
    if (mutation) {
      var blockText = '<xml>' +
          '<block type="procedures_definition">' +
          '<statement name="custom_block">' +
          '<shadow type="procedures_prototype">' +
          Blockly.Xml.domToText(mutation) +
          '</shadow>' +
          '</statement>' +
          '</block>' +
          '</xml>';
      var blockDom = Blockly.Xml.textToDom(blockText).firstChild;
      Blockly.Events.setGroup(true);
      var block = Blockly.Xml.domToBlock(blockDom, workspace);
      var scale = workspace.scale; // To convert from pixel units to workspace units
      // Position the block so that it is at the top left of the visible workspace,
      // padded from the edge by 30 units. Position in the top right if RTL.
      var posX = -workspace.scrollX;
      if (workspace.RTL) {
        posX += workspace.getMetrics().contentWidth - 30;
      } else {
        posX += 30;
      }
      block.moveBy(posX / scale, (-workspace.scrollY + 30) / scale);
      block.scheduleSnapAndBump();
      Blockly.Events.setGroup(false);
    }
  };
};

/**
 * Callback to open the modal for editing custom procedures.
 * @param {!Blockly.Block} block The block that was right-clicked.
 * @private
 */
Blockly.Procedures.editProcedureCallback_ = function(block) {
  // Edit can come from one of three block types (call, define, prototype)
  // Normalize by setting the block to the prototype block for the procedure.
  if (block.type == Blockly.PROCEDURES_DEFINITION_BLOCK_TYPE) {
    var input = block.getInput('custom_block');
    if (!input) {
      alert('Bad input'); // TODO: Decide what to do about this.
      return;
    }
    var conn = input.connection;
    if (!conn) {
      alert('Bad connection'); // TODO: Decide what to do about this.
      return;
    }
    var innerBlock = conn.targetBlock();
    if (!innerBlock ||
        !innerBlock.type == Blockly.PROCEDURES_PROTOTYPE_BLOCK_TYPE) {
      alert('Bad inner block'); // TODO: Decide what to do about this.
      return;
    }
    block = innerBlock;
  } else if (block.type == Blockly.PROCEDURES_CALL_BLOCK_TYPE) {
    // This is a call block, find the prototype corresponding to the procCode.
    // Make sure to search the correct workspace, call block can be in flyout.
    var workspaceToSearch = block.workspace.isFlyout ?
        block.workspace.targetWorkspace : block.workspace;
    block = Blockly.Procedures.getPrototypeBlock(
        block.getProcCode(), workspaceToSearch);
  }
  // Block now refers to the procedure prototype block, it is safe to proceed.
  Blockly.Procedures.externalProcedureDefCallback(
      block.mutationToDom(),
      Blockly.Procedures.editProcedureCallbackFactory_(block)
  );
};

/**
 * Callback factory for editing an existing custom procedure.
 * @param {!Blockly.Block} block The procedure prototype block being edited.
 * @return {function(?Element)} Callback for editing the custom procedure.
 * @private
 */
Blockly.Procedures.editProcedureCallbackFactory_ = function(block) {
  return function(mutation) {
    if (mutation) {
      Blockly.Procedures.mutateCallersAndPrototype(block.getProcCode(),
          block.workspace, mutation);
    }
  };
};

/**
 * Callback to create a new procedure custom command block.
 * @public
 */
Blockly.Procedures.externalProcedureDefCallback = function(/** mutator, callback */) {
  alert('External procedure editor must be override Blockly.Procedures.externalProcedureDefCallback');
};

/**
 * Make a context menu option for editing a custom procedure.
 * This appears in the context menu for procedure definitions and procedure
 * calls.
 * @param {!Blockly.BlockSvg} block The block where the right-click originated.
 * @return {!Object} A menu option, containing text, enabled, and a callback.
 * @package
 */
Blockly.Procedures.makeEditOption = function(block) {
  var editOption = {
    enabled: true,
    text: Blockly.Msg.EDIT_PROCEDURE,
    callback: function() {
      Blockly.Procedures.editProcedureCallback_(block);
    }
  };
  return editOption;
};

Blockly.Procedures.makeChangeTypeOption = function(block) {
  var isStatement = block.getReturn() === Blockly.PROCEDURES_CALL_TYPE_STATEMENT;
  var option = {
    enabled: true,
    text: isStatement ? Blockly.Msg.PROCEDURES_TO_REPORTER : Blockly.Msg.PROCEDURES_TO_STATEMENT,
    callback: function() {
      // Update shape of loose blocks when return types change.
      // var newType = isStatement ? Blockly.PROCEDURES_CALL_TYPE_REPORTER : Blockly.PROCEDURES_CALL_TYPE_STATEMENT;
      var newType;
      if (isStatement) {
        var procCode = block.getProcCode();
        var workspace = block.workspace;
        var actualReturnType = Blockly.Procedures.getProcedureReturnType(procCode, workspace);
        // If the definition is boolean-shaped:
        // The the reporter should be boolean-shaped, else:
        // !!! 'normal reporter shaped', etc.(?!)? ???
        // Normal reporter shaped.
        newType = (
          actualReturnType === Blockly.PROCEDURES_CALL_TYPE_BOOLEAN ?
          actualReturnType :
          Blockly.PROCEDURES_CALL_TYPE_REPORTER
        );
      } else {
        newType = Blockly.PROCEDURES_CALL_TYPE_STATEMENT;
      }

      Blockly.Events.setGroup(true);
      try {
        // Update shape of loose blocks when return types change.
        // Blockly.Events.setGroup(true);

        // block.unplug(true);
        // var workspace = block.workspace;
        // var xml = Blockly.Xml.blockToDom(block);
        // var xy = block.getRelativeToSurfaceXY();
        // block.dispose();

        // var mutation = xml.querySelector('mutation');
        // if (isStatement) {
        //   mutation.setAttribute('return', Blockly.PROCEDURES_CALL_TYPE_REPORTER);
        // } else {
        //   mutation.setAttribute('return', Blockly.PROCEDURES_CALL_TYPE_STATEMENT);
        // }

        // var newBlock = Blockly.Xml.domToBlock(xml, workspace);
        // newBlock.moveBy(xy.x, xy.y);
        Blockly.Procedures.changeReturnType(block, newType);
      } finally {
        // block.unplug(true);
        Blockly.Events.setGroup(false);
      }
    }
  };
  return option;
};

// Update shape of loose blocks when return types change.
Blockly.Procedures.changeReturnType = function(block, returnType) {
  block.unplug(true);
  var workspace = block.workspace;
  var xml = Blockly.Xml.blockToDom(block);
  var xy = block.getRelativeToSurfaceXY();
  block.dispose();

  var mutation = xml.querySelector('mutation');
  mutation.setAttribute('return', returnType);

  var newBlock = Blockly.Xml.domToBlock(xml, workspace);
  newBlock.moveBy(xy.x, xy.y);
};

/**
 * Callback to show the procedure definition corresponding to a custom command
 * block.
 * TODO(#1136): Implement.
 * @param {!Blockly.Block} block The block that was right-clicked.
 * @private
 */
Blockly.Procedures.showProcedureDefCallback_ = function(block) {
  alert('TODO(#1136): implement showing procedure definition (procCode was "' +
      block.procCode_ + '")');
};

/**
 * Make a context menu option for showing the definition for a custom procedure,
 * based on a right-click on a custom command block.
 * @param {!Blockly.BlockSvg} block The block where the right-click originated.
 * @return {!Object} A menu option, containing text, enabled, and a callback.
 * @package
 */
Blockly.Procedures.makeShowDefinitionOption = function(block) {
  var option = {
    enabled: true,
    text: Blockly.Msg.SHOW_PROCEDURE_DEFINITION,
    callback: function() {
      Blockly.Procedures.showProcedureDefCallback_(block);
    }
  };
  return option;
};

/**
 * Callback to try to delete a custom block definitions.
 * @param {string} procCode The identifier of the procedure to delete.
 * @param {!Blockly.Block} definitionRoot The root block of the stack that
 *     defines the custom procedure.
 * @return {boolean} True if the custom procedure was deleted, false otherwise.
 * @package
 */
Blockly.Procedures.deleteProcedureDefCallback = function(procCode,
    definitionRoot) {
  var callers = Blockly.Procedures.getCallers(procCode,
      definitionRoot.workspace, definitionRoot, false /* allowRecursive */);
  if (callers.length > 0) {
    return false;
  }

  var workspace = definitionRoot.workspace;

  // Delete the whole stack.
  Blockly.Events.setGroup(true);
  definitionRoot.dispose();
  Blockly.Events.setGroup(false);

  // !!! 'TODO'? ???
  // TODO (#1354) Update this function when '_' is removed
  // Refresh toolbox, so caller doesn't appear there anymore
  workspace.refreshToolboxSelection_();

  return true;
};

/**
 * If `true`, the user will be able to manually override the shape of procedure call blocks.
 */
Blockly.Procedures.USER_CAN_CHANGE_CALL_TYPE = true;

/**
 * If `false`, a round procedure call reporter can be dropped into any input, including boolean ones.
 */
Blockly.Procedures.ENFORCE_TYPES = false;

/**
 * If `true`, the return block will always be available;
 * else if `false`, either create a block that requires returns or
 * call 'workspace.enableProcedureReturns()' to enable return blocks.
 */
Blockly.Procedures.DEFAULT_ENABLE_RETURNS = false;

// Allow custom boolean reporters.
/**
 * @param {string} procCode The procedure code.
 * @param {Blockly.Workspace} workspace The workspace.
 * @returns {number} The type of the return block, or `false` if no define block.
 */
// Blockly.Procedures.procedureContainsReturn = function(procCode, workspace) {
// Blockly.Procedures.procedureContainsReturnType = function(procCode, workspace) {
Blockly.Procedures.getProcedureReturnType = function(procCode, workspace) {
  var defineBlock = Blockly.Procedures.getDefineBlock(procCode, workspace);
  if (!defineBlock) {
    // return false;
    return Blockly.PROCEDURES_CALL_TYPE_STATEMENT;
  }
  // return Blockly.Procedures.blockContainsReturn(defineBlock);
  // return Blockly.Procedures.blockContainsReturnType(defineBlock);
  return Blockly.Procedures.getBlockReturnType(defineBlock);
};

/**
 * @param {Blockly.Workspace} workspace The workspace.
 * @returns {Record<string, number>} The return type of each procedure in the workspace.
 */
Blockly.Procedures.getAllProcedureReturnTypes = function(workspace) {
  var result = Object.create(null);
  var blocks = workspace.getTopBlocks(false);
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (block.type == Blockly.PROCEDURES_DEFINITION_BLOCK_TYPE && !block.isInsertionMarker()) {
      var procCode = block.getInput('custom_block').connection.targetBlock().getProcCode();
      // To match behavior of 'getDefineBlock':
      // If multiple instances of this procedure are defined:
      // Only use the first one.
      if (!Object.prototype.hasOwnProperty.call(result, procCode)) {
        result[procCode] = Blockly.Procedures.getBlockReturnType(block);
      }
    }
  }
  return result;
};


// Allow custom boolean reporters.
/**
 * @param {Blockly.Block} block The block.
 * @returns {number} The type of the return block.
 */
// Blockly.Procedures.blockContainsReturn = function(block) {
// Blockly.Procedures.blockContainsReturnType = function(block) {
Blockly.Procedures.getBlockReturnType = function(block) {
  var hasSeenBooleanReturn = false;
  /** @type {Blockly.Block[]} */
  var descendants = block.getDescendants();
  for (var i = 0; i < descendants.length; i++) {
    if (descendants[i].type === Blockly.PROCEDURES_RETURN_BLOCK_TYPE) {
      // return true;
      // !!! ???
      // The block at i + 1 should be the block inside of the return block.
      // Even if the return block is missing its input, this will still be fine, as:
      // The next block should be a stacked block which won't be hexagon-shaped.
      if (i + 1 < descendants.length && descendants[i + 1].outputShape_ === Blockly.OUTPUT_SHAPE_HEXAGONAL) {
        // Keep searching, as:
        // There may be other, non-boolean returns in this function definition.
        hasSeenBooleanReturn = true;
      } else {
        return Blockly.PROCEDURES_CALL_TYPE_REPORTER;
      }
    }
  }
  // return false;
  if (hasSeenBooleanReturn) {
    return Blockly.PROCEDURES_CALL_TYPE_BOOLEAN;
  } else {
    return Blockly.PROCEDURES_CALL_TYPE_STATEMENT;
  }
};
