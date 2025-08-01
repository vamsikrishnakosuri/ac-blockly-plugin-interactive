import * as Blockly from 'blockly/core';
import {Constants} from "../index";

export class Speech {
    constructor() {
        this.result = null;
        this.changedResult = null;
        this.toggle = false;
        this.readTimeouts = []
    }

    say(text) {
        let blockReader = document.getElementById("blockReader");
        const filler = this.toggle ? " " : "\u200B"; // toggle between space and zero-width space
        this.toggle = !this.toggle;
        blockReader.innerHTML = `<span>${text}${filler}</span>`;
    }

    clearPreviousSpeeches() {
        this.readTimeouts.forEach(id => cancelAnimationFrame(id));
        this.readTimeouts = [];
    }

    update(text) {
        this.clearPreviousSpeeches();
        // Schedule single DOM change so screen reader announce exactly once
        const speak = () => {
            const filler   = this.toggle ? ' ' : '\u200B';  // ensure diff
            this.toggle    = !this.toggle;
            const reader   = document.getElementById('blockReader');
            reader.textContent = '';              // reset text
            reader.textContent = `${text}${filler}`;
        };
        const id = requestAnimationFrame(speak);
        this.readTimeouts.push(id);
    }


    getFirstStatementConnection(block) {
        if (!block || !block.inputList) return null;

        for (const input of block.inputList) {
            if (
                input.connection &&
                input.connection.type === Blockly.ConnectionType.NEXT_STATEMENT
            ) {
                return input.connection;
            }
        }

        return null;
    }

    updateBlockReader(disabled, type, blockSvg, state, movement) {
        let newStr;
        let defaultStr;
        let outputStr = "";
        this.clearPreviousSpeeches();
        let prefixTxt = this.getTextFromMoveType(movement);

        if (!blockSvg) {
            if (!type) {
                outputStr = " no block found"
            } else {
                outputStr = type + " selected";
            }
            this.update(prefixTxt + " " + outputStr);
            return;
        }

        //only update the screen reader if something has changed
        // if (!this.changedResult) {
        //     defaultStr = this.blockToText(type);
        // } else {
        //     defaultStr = this.changedResult;
        // }

        //go through the blocks on the workspace and find the matching one based on type and id
        newStr = this.changeString(blockSvg);

        if (disabled) {
            outputStr = "disabled";
        }

        outputStr = outputStr + " " + newStr;

        if (this.getFirstStatementConnection(blockSvg) != null) {
            outputStr = "container block " + outputStr;
        }

        outputStr = prefixTxt + " " + outputStr;
        this.update(outputStr);
    }

    stateToText(state) {
        let txt = "";

        switch (state) {
            case Constants.STATE.WORKSPACE:
                txt = "workspace";
                break
            case Constants.STATE.FLYOUT:
                txt = "flyout";
                break
            case Constants.STATE.TOOLBOX:
                return "toolbox";
            default:
                break;
        }
        return txt;
    }

    blockToText(type, disabled) {
        var disabledText = "";
        ;

        switch (type) {
            case "beep":
                this.result = "beep frequency (A) duration (B) time until played (C)";
                break;
            case "controls_if"    :
                this.result = "if (A), do container"; //added container
                break;
            case "controls_elseif":
                this.result = "else if (A) container"; //added container
                break;
            case "controls_else":
                this.result = "else container"; //added container
                break;
            case "logic_compare"  :
                this.result = " (A) 'equals' (B)";
                break;
            case "logic_operation":
                this.result = " (A) 'and/or' (B)";
                break;
            case "logic_negate":
                this.result = "not (  )";
                break;
            case "logic_boolean":
                this.result = "'true or false'";
                break;
            case "logic_null":
                this.result = "null";
                break;
            case "logic_ternary":
                this.result = "Test (A), if true do (B), if false do (C)";
                break;
            case "controls_repeat_ext":
                //this.result = "repeat (blank) times container"; //added container
                this.result = "repeat (A) times container"; //added container
                break;
            //added custom block speech (interface.html:545)
            case "controls_repeat":
                this.result = "repeat (10) times container"; //added container
                break;
            case "controls_whileUntil":
                this.result = "repeat 'while or until' ( ) container"; //added container
                break;
            case "controls_for":
                //this.result = "count with 'i' from (1) to (10) by (1) container"; //added container
                this.result = "count with 'i' from (A) to (B) by (C) container"; //added container
                break;
            case "controls_forEach":
                this.result = "for each item 'i' in list ( ) container"; //added container
                break;
            case "controls_flow_statements":
                this.result = "'break out' of loop";
                break;
            case "math_number":
                this.result = "'number'";
                break;
            case "math_arithmetic":
                this.result = "(A) '+' (B)";
                break;
            case "math_single":
                this.result = "'square root' of (A)";
                break;
            case "math_trig":
                this.result = "'trig' ( )";
                break;
            case "math_constant":
                this.result = "'pi and constants'";
                break;
            case "math_number_property":
                this.result = "(number) is 'even'";
                break;
            case "math_change":
                this.result = "change (variable) by 'number'";
                break;
            case "math_round":
                this.result = "'round' (number)";
                break;
            case "math_on_list":
                this.result = "'sum' of list ( )";
                break;
            case "math_modulo":
                this.result = "remainder of (A) divided by (B)";
                break;
            case "math_constrain":
                //this.result = "constrain (A) between low (1) and high (100)";
                this.result = "constrain (A) between low (B) and high (C)";
                break;
            case "math_random_int":
                //this.result = "random integer from (1) to (100)";
                this.result = "random integer from (A) to (B)";
                break;
            case "math_random_float":
                this.result = "random fraction";
                break;
            case "text":
                this.result = "empty 'text' value";
                break;
            case "text_join":
                this.result = "Create text with '2 or more' items";
                //loop through blocks to add inputs dynamically
                //check if block is selected; prevents nav from getting stuck
                if (Blockly.common.getSelected()) {
                    for (var i = 0; i < Blockly.common.getSelected().itemCount_ + 1; i++) {
                        this.result += " ,() ";
                    }
                }
                break;
            case "text_append":
                this.result = "to 'item' append text (  )";
                break;
            case "text_length":
                this.result = "length of (text)";
                break;
            case "text_isEmpty":
                this.result = "(A) is empty";
                break;
            case "text_indexOf":
                this.result = "in (text) find 'first or last' occurence of text (A)";
                break;
            case "text_charAt":
                this.result = "in text (text) get 'character at index' (A)";
                break;
            case "text_getSubstring":
                this.result = "in text (text) get substring from ',index' (A) to 'index' (B) ";
                break;
            case "text_changeCase":
                this.result = " to 'upper or lower' case ( )";
                break;
            case "text_trim":
                this.result = "trim spaces from 'both sides' of ()";
                break;
            case "text_print":
                this.result = "print ( )";
                break;
            case "text_prompt_ext":
                this.result = "prompt for 'text' with message ' text'";
                break;
            case "lists_create_empty":
                this.result = "create empty list";
                break;
            case "lists_create_with":
                this.result = "create list with '3' items";
                //loop through blocks to add parameters dynamically
                //check if block is selected; prevents nav from getting stuck
                if (Blockly.common.getSelected()) {
                    for (var i = 0; i < Blockly.common.getSelected().itemCount_ + 1; i++) {
                        this.result += " ,() ";
                    }
                }
                break;
            case "lists_repeat":
                this.result = "create list with item (A) repeated (B) times";
                break;
            case "lists_length":
                this.result = "length of ( ) list";
                break;
            case "lists_isEmpty":
                this.result = "the list (list) is empty";
                break;
            case "lists_indexOf":
                this.result = "in list (list) find 'first' occurence of item (A)";
                break;
            case "lists_getIndex":
                this.result = "in list (list) 'get', 'index' (A)";
                break;
            case "lists_setIndex":
                this.result = "in list (list) 'set' 'index' (A) as (B)";
                break;
            case "lists_getSublist":
                this.result = "in list (list) get sub-list from 'index' (A) to ',index' (B)";
                break;
            case "lists_split":
                this.result = "make 'list from text' (A) with delimiter 'comma'";
                break;
            case "colour_picker":
                this.result = "colour";
                break;
            case "colour_random":
                this.result = "random colour";
                break;
            case "colour_rgb":
                this.result = "colour with: red 'Value', green 'value,', blue ',value' ";
                break;
            case "colour_blend":
                this.result = "blend colour 1 'colour' and colour 2 'colour' with ratio 'decimal'";
                break;
            case "procedures_defnoreturn":
                this.result = "function to 'do something', with '0' parameters";
                break;
            case "procedures_defreturn":
                this.result = "function to 'do something', with '0' parameters then return ( )";
                break;
            case "procedures_ifreturn":
                this.result = "if (A) then return (B)";
                break;
            case "procedures_callreturn":
            case "procedures_callnoreturn":
                this.result = Blockly.common.getSelected().inputList[0].fieldRow[0].text_;
                //loop through blocks to add parameters dynamically
                for (var i = 0; i < Blockly.common.getSelected().arguments_.length; i++) {
                    if (i == 0) {
                        this.result += " with ";
                    }
                    this.result += Blockly.common.getSelected().arguments_[i] + " '' ";
                }
                break;
            case "variables_set":
                this.result = "set 'variable' to (A)";
                break;
            case "variables_get":
                this.result = "get 'A'";
                break;
            default:
                console.log("speech type:" + type)
                this.result = "custom";
                break;
        }

        if (disabled) {
            disabledText = "disabled ";
        }
        if (this.changedResult) {
            this.result = this.changedResult;
        }
        return disabledText + this.result + " block.";
    }

    changeString(blockSvg) {
        var text = [];
        var alphabet = [' A, ', ' B, ', ' C, ', ' D, ', ' E, ', ' F, ', ' G, ', ' H, ', ' I, ', ' J, '];
        var count = 0;

        if (blockSvg.collapsed_) {
            text.push(blockSvg.getInput('_TEMP_COLLAPSED_INPUT').fieldRow[0].text_);
        } else {

            var inputList = blockSvg.inputList;
            var input;

            for (var i = 0; i < inputList.length; i++) {
                console.log("TYPE:" + inputList[i].type);
                //inline child connection
                if (inputList[i].type == 1) {
                    input = inputList[i];
                    //get all the fields
                    for (var j = 0, field; field = input.fieldRow[j]; j++) {
                        text.push(" " + this.convertSpecialCharacterToWord(field.getText()));
                    }
                    //get inner blocks
                    if (input.connection) {
                        var child = input.connection.targetBlock();

                        if (child) {
                            //TODO: make this part cleaner
                            //replaces ? with a,b etc for screen reader ability
                            var childStr = child.toString();
                            var splitArr = childStr.split(' ');
                            var newChildStr = " ";

                            for (var k = 0; k < splitArr.length; k++) {
                                // console.log("splitArrK: " + "#" + splitArr[k] + "#");

                                if (splitArr[k] == '?' || splitArr[k] == '???' || splitArr[k] == '') {
                                    splitArr[k] = 'empty value';
                                }
                                splitArr[k] = " " + this.convertSpecialCharacterToWord(splitArr[k]);

                                newChildStr += splitArr[k];
                            }
                            text.push(newChildStr);
                        } else {
                            text.push(alphabet[count]);
                            count++;
                        }
                    }
                    //shouldn't need more than 10 variables in a single block....
                    if (count > alphabet.length - 1) {
                        count = 0;
                    }

                }
                //type three blocks are inner statements that don't need to be read
                else if (inputList[i].type != 3) {
                    input = inputList[i];
                    for (var j = 0, field; field = input.fieldRow[j]; j++) {
                        text.push(" " + this.convertSpecialCharacterToWord(field.getText()));
                    }
                }

            }
        }

        text = text.join(' ').trim(text.join(' ')) || alphabet[count];
        if (text == "“    ”") {
            text = "“ empty string ”";
        }
        console.log(">>>: string: " + text);
        return text;
    }

    convertSpecialCharacterToWord(specialCharacter) {
        /*
        TO-DO: replace strings with their variables names from ../msg/ files for internationalization
        e.g %{BKY_MATH_ADDITION_SYMBOL}"  should replace \u002B below
        */
        var wordEquivalent;

        switch (specialCharacter) {
            case "=":
                wordEquivalent = "equals";
                break;
            case "\u2260":
                wordEquivalent = "is not equal to";
                break;
            case "\u200F<":
                wordEquivalent = "is less than";
                break;
            case "\u200F\u2264":
                wordEquivalent = "is less than or equal to";
                break;
            case "\u200F>":
                wordEquivalent = "is greater than";
                break;
            case "\u200F\u2265":
                wordEquivalent = "is greater than or equal to";
                break;
            case '\u002B':
                wordEquivalent = "plus";
                break;
            case '\u002D':
                wordEquivalent = "minus";
                break;
            case "×":
                wordEquivalent = "times";
                break;
            case '\u00F7':
                wordEquivalent = "divided by";
                break;
            case "^" :
                wordEquivalent = "to the power of";
                break;
            default:
                wordEquivalent = specialCharacter;
                break;
        }

        return wordEquivalent;

    }

    getTextFromMoveType(type) {
        if (!type) return "";

        switch (type) {
            case Constants.SHORTCUT_NAMES.NEXT:
                return "moving down";
            case Constants.SHORTCUT_NAMES.PREVIOUS:
                return "moving up";
            case Constants.SHORTCUT_NAMES.IN:
                return "moving right";
            case Constants.SHORTCUT_NAMES.OUT:
                return "moving left";
            case Constants.SHORTCUT_NAMES.LAYER_IN:
                return "nesting in";
            case Constants.SHORTCUT_NAMES.LAYER_OUT:
                return "nesting out";
            default:
                return "";
        }
    }

    process(block, movement, state) {
        if (!block && !movement) {
            return;
        }

        if (block) {
            if (block.getType() === Blockly.ASTNode.types.STACK ||
                block.getType() === Blockly.ASTNode.types.WORKSPACE) {
                this.updateBlockReader(null, block.getType(), null, state, movement);
            } else {
                let srcBlock = block.getSourceBlock();
                this.updateBlockReader(!srcBlock.isEnabled(), srcBlock.type, srcBlock, state, movement);
            }
        } else {
            this.updateBlockReader(null, null, null, state, movement);
        }
    }

    announceCategory(category, direction = '') {
        let postfix = '';
        if (!category) return;
        const name = (typeof category.getName === 'function')
            ? category.getName()
            : category.name_;          // fallback

        let prefix;
        switch (direction) {
            case Constants.SHORTCUT_NAMES.NEXT:
                prefix = 'Move to next category';
                break;
            case Constants.SHORTCUT_NAMES.PREVIOUS:
                prefix = 'Move to previous category';
                break;
            case Constants.SHORTCUT_NAMES.IN:
                prefix = 'Entered category';
                break;
            case Constants.SHORTCUT_NAMES.OUT:
                prefix = 'Back to category';
                break;
            default:
                prefix = 'Toolbox category';
                postfix = 'selected'
        }

        this.update(`${prefix}: ${name} ${postfix}`);
    }


    announceFlyoutItem(node, direction = '') {
        if (!node) {
            const edge = (direction === Constants.SHORTCUT_NAMES.PREVIOUS)
                ? 'top'
                : 'bottom';
            this.update(`Reached ${edge} of flyout`);
            return;
        }

        let label = '';
        switch (node.getType()) {
            case Blockly.ASTNode.types.BUTTON: {
                const btn = node.getLocation();
                label = btn.getText().trim();
                break;
            }

            default: {
                const blockSvg = node.getSourceBlock();
                const disabled = !blockSvg.isEnabled();
                label = this.blockToText(blockSvg.type, disabled);

                // fallback
                if (!label || label.toLowerCase().startsWith('custom')) {
                    label =
                        blockSvg.toString().trim() ||
                        (blockSvg.tooltip && blockSvg.tooltip.trim()) ||
                        blockSvg.type;
                }
            }
        }

        let categoryName = '';
        const categoryObj = Blockly.getMainWorkspace()
            ?.getToolbox()
            ?.getSelectedItem();
        if (categoryObj) {
            categoryName = (typeof categoryObj.getName === 'function')
                ? categoryObj.getName()
                : (categoryObj.name_ || '');
        }
        // fallback
        if (!categoryName) {
            const labelEl = document.querySelector(
                '.blocklyTreeSelected .blocklyTreeRowContentContainer .blocklyTreeLabel'
            );
            if (labelEl) categoryName = labelEl.textContent.trim();
        }
        const dirstrt = (direction === Constants.SHORTCUT_NAMES.PREVIOUS)
            ? 'back'
            : '';
        const phrase = `Move ${dirstrt} to item named ${label} under ${categoryName} category`;
        this.update(phrase);
    }


    friendlyName(blkSvg) {
        if (!blkSvg) return '';
        const disabled = !blkSvg.isEnabled();
        let txt = this.blockToText(blkSvg.type, disabled);
        if (!txt || txt.toLowerCase().startsWith('custom')) {
            txt =
                blkSvg.toString().trim() ||
                (blkSvg.tooltip && blkSvg.tooltip.trim()) ||
                blkSvg.type;
        }
        return txt;
    };

    announceInsertedBlock(newBlock, originalBlock, dirKey='') {
        if (!newBlock) return;

        const newBlockSvg = newBlock.getSourceBlock();

        const newLabel = this.friendlyName(newBlockSvg);

        if (!originalBlock) {
            this.update(`Inserted ${newLabel}`);
            return;
        }

        const refLabel = this.friendlyName(originalBlock);

        const dirWordMap = {
            TOP   : 'above',
            BOTTOM: 'below',
            RIGHT : 'to the right of',
        };
        const dirWord = dirWordMap[dirKey] || 'near';

        this.update(`${newLabel} inserted ${dirWord} ${refLabel}`);
    }


    announceMark(node, originalBlock = null, dirKey = '') {
        if (!node) return;
        if (originalBlock && dirKey) {
            const dirWordMap = {
                TOP   : 'top',
                BOTTOM: 'bottom',
                RIGHT : 'right',
            };
            const dirWord = dirWordMap[dirKey] || 'near';
            const refLabel = this.friendlyName(originalBlock);
            this.update(`Marked ${dirWord} connection of ${refLabel}`);
            return;
        }

        if (node.getType() === Blockly.ASTNode.types.WORKSPACE) {
            this.update('Workspace location marked');
            return;
        }

        this.update(`Marked top connection of ${this.friendlyName(node.getSourceBlock && node.getSourceBlock())}`);
    }

    announceReturnToWorkspace(node) {
        let phrase = 'Toolbox closed. ';

        if (!node) {
            this.update(`${phrase} Cursor back on workspace`);
            return;
        }

        if (node.getType() === Blockly.ASTNode.types.WORKSPACE) {
            this.update(`${phrase} Cursor back on workspace`);
            return;
        }

        const blk = node.getSourceBlock && node.getSourceBlock();
        phrase += `Cursor back on ${this.friendlyName(blk)}`;
        this.update(phrase);
    }
}
