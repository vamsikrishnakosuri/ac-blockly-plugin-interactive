// import * as Blockly from "https://unpkg.com/blockly/blockly.min.js";
// import { javascriptGenerator } from "https://unpkg.com/blockly/javascript.min.js";
// import { pythonGenerator } from "https://unpkg.com/blockly/python.min.js";
// import { phpGenerator } from "https://unpkg.com/blockly/php.min.js";
// import { luaGenerator } from "https://unpkg.com/blockly/lua.min.js";
// import { dartGenerator } from "https://unpkg.com/blockly/dart.min.js";

function initWorkspace() {
    // Blockly Workspace Initialization
    const workspace = Blockly.inject('blocklyDiv', {
        toolbox: toolboxConfig,
        grid: {spacing: 20, length: 3, colour: "#ccc", snap: true},
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: true
        },
        trashcan: true
    });

    let nav = new NavigationController();
    nav.init();
    nav.addWorkspace(workspace);

    document.getElementById("runButton").addEventListener("click", () => {
        generateCode(Blockly.getMainWorkspace());
        try {
            eval(document.getElementById("codeOutput").textContent);
        } catch (error) {
            alert("Error executing JavaScript code: " + error.message);
        }
    });

    document.getElementById("languageSelect").addEventListener("change", generateCode);
    document.getElementById("loadXmlButton").addEventListener("click", ()=> loadXmlToWorkspace(workspace));
    document.getElementById("programSelect").addEventListener("change", loadProgramXmlToTextArea);
}

// list block program xml
const PROGRAMS = [
  { "id": "Task1", "label": "Task 1", "file": "xml/tasks/task-1.xml" },
  { "id": "Task2", "label": "Task 2 (Incomplete)",   "file": "xml/tasks/task-2.xml" },
  { "id": "Task2Comp", "label": "Task 2 (Complete)",    "file": "xml/tasks/task-2-complete.xml" },
    { "id": "Test1", "label": "Test 1",    "file": "xml/tests/test1.xml" },
    { "id": "Test2", "label": "Test 2",    "file": "xml/tests/test2.xml" },
];


document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('programSelect');
  const btn = document.getElementById('loadXmlButton');

  PROGRAMS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    select.appendChild(opt);
  });

  btn.addEventListener('click', loadProgramXmlToTextArea);
});

async function loadProgramXmlToTextArea() {
  const select = document.getElementById('programSelect');
  const textArea = document.getElementById('xmlTextArea');
  if (!select.value) {
    alert('Pick a program first.');
    return;
  }

  const entry = PROGRAMS.find(p => p.id === select.value);
  if (!entry) return;

  try {
    const res = await fetch(entry.file, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    textArea.value = await res.text();
  } catch (e) {
    console.error(e);
    alert('Could not load XML file.');
  }
}



function loadXmlToWorkspace(workspace, xmlTextAreaId = "xmlTextArea") {
    const input = document.getElementById("xmlTextArea");
    try {
        const xml = (Blockly.Xml.textToDom || Blockly.utils.xml.textToDom)(input.value);
        Blockly.Xml.clearWorkspaceAndLoadFromXml(xml.documentElement || xml, workspace);
    } catch (e) {
        alert("Invalid XML format.");
        console.error(e);
    }
}


function generateCode() {
    const language = document.getElementById("languageSelect").value;
    let code;
    switch (language) {
        case "javascript":
            code = javascript.javascriptGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "python":
            code = python.pythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "php":
            code = php.phpGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "lua":
            code = lua.luaGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "dart":
            code = dart.dartGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "xml":
            const xmlDom = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace());
            code = Blockly.Xml.domToPrettyText(xmlDom);
            console.log("what: " + code);
            break;
        default:
            code = "// Select a language";
    }
    let codePanel = document.getElementById("codeOutput");
    codePanel.textContent = code;
    codePanel.classList.remove('prettyprinted');
    if (typeof PR === 'object') {
        PR.prettyPrint();
    }
}
