import * as Blockly from "blockly/core";

export function isContainerBlock(block) {
    if (!block || typeof block.inputList !== 'object') return false;

    // Common container block types that support nested statements
    const knownContainerTypes = [
        'controls_if',
        'controls_repeat_ext',
        'controls_whileUntil',
        'controls_for',
        'controls_forEach',
        'controls_flow_statements',
        'procedures_defnoreturn',
        'procedures_defreturn',
        'procedures_ifreturn',
    ];

    if (knownContainerTypes.includes(block.type)) {
        return true;
    }

    // Check if the block has any NEXT_STATEMENT inputs
    for (const input of block.inputList) {
        if (input.connection &&
            input.connection.type === Blockly.NEXT_STATEMENT) {
            return true;
        }
    }

    return false;
}
