// list block program xml
const PROGRAMS = [
    { "id": "Task1", "label": "Task 1", "file": "xml/tasks/task-1.xml" },
    { "id": "Task2", "label": "Task 2 (Incomplete)",   "file": "xml/tasks/task-2.xml" },
    { "id": "Task2Comp", "label": "Task 2 (Complete)",    "file": "xml/tasks/task-2-complete.xml" },
    { "id": "Test1", "label": "Test 1",    "file": "xml/tests/test1.xml" },
    { "id": "Test2", "label": "Test 2",    "file": "xml/tests/test2.xml" },
];

const KEY_HINTS = [
    { key: "W", node: "Move to block above" },
    { key: "S", node: "Move to block below" },
    { key: "A", node: "Move to block left" },
    { key: "F", node: "Move to block right" },
    { key: "F", node: "Nest in one level (Workspace → Stack → Block → Field/Input)" },
    { key: "Q", node: "Nest out one level (Field/Input → Block → Stack → Workspace)" },
    { key: "E", node: "Enable/Disable Edit mode" },
    { key: "X", node: "Disconnect a block when on a connection (Edit mode)" },
    { key: "T", node: "Open the toolbox; use W/A/S/D to browse; Enter to insert" },
    { key: "Ctrl+Shift+K", node: "Enable/disable keyboard navigation focus ring" }
];


function populateProgramsToDom() {
    const select = document.getElementById('programSelect');
    select.innerHTML = '<option value="">None — select a program…</option>';
    PROGRAMS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.label;
        select.appendChild(opt);
    });
}

function renderKeyboardHints(hints) {
    const data = Array.isArray(hints) && hints.length ? hints : KEY_HINTS;
    const dl = document.getElementById('keyboardHintList');
    if (!dl) return;
    dl.innerHTML = '';

    const quote = (s) => `"${s}"`;
    const describe = ({ key = '', node = null, type = null } = {}) => {
        const K = key?.toUpperCase();
        const T = type?.toLowerCase();
        // hand edit mode hint
        if (T === 'edit') {
            if (typeof node === 'boolean') {
                return node ? 'Exit Edit mode' : 'Enter Edit mode';
            }
            return 'Toggle Edit mode';
        }

        if (T === 'workspace') {
            return (K === 'A' || K === 'Q') ? 'Move out to workspace' : 'Focus workspace';
        }

        if (T === 'stack') {
            const name = node || '';
            if (K === 'W') return `Move to stack ${quote(name)} above`;
            if (K === 'S') return `Move to stack ${quote(name)} below`;
            if (K === 'D' || K === 'F') return `Nest into stack ${quote(name)}`;
            if (K === 'A' || K === 'Q') return `Nest out to stack ${quote(name)}`;
            return `Focus stack ${quote(name)}`;
        }

        if (T === 'block') {
            const name = node || 'block';
            if (K === 'W') return `Move to above: ${quote(name)}`;
            if (K === 'S') return `Move to below: ${quote(name)}`;
            if (K === 'D') return `Move to right: ${quote(name)}`;
            if (K === 'F') return `Nest into: ${quote(name)}`;
            if (K === 'A') return `Move to left: ${quote(name)}`;
            if (K === 'Q') return `Nest out to: ${quote(name)}`;
            return `Focus ${quote(name)}`;
        }

        if (T === 'connection') {
            const name = node || 'unknown';
            if (K === 'F') return `Focus nested connection of edit block`;
            if (K === 'D') return `Move right connection of edit block`;
            if (K === 'A') return `Move to left connection of edit block`;
            if (K === 'W') return `Move to top connection of edit block`;
            if (K === 'S') return `Move to bottom connection of edit block`;
            return `Focus connection (has ${quote(name)})`;
        }

        if (typeof node === 'string' && node) {
            return node;
        }

        return 'No action';
    };

    for (const item of data) {
        const { key = '' } = item || {};
        const desc = describe(item);

        const dt = document.createElement('dt');
        dt.innerHTML = `<kbd>${key}</kbd>`;

        const dd = document.createElement('dd');
        dd.textContent = desc;

        dl.appendChild(dt);
        dl.appendChild(dd);
    }
}


let __instrSlides = [];
let __instrIndex  = 0;

function initInstructionSlider() {
    const section = document.getElementById('instructionSection');
    const body    = document.getElementById('instructionBody');
    const prevBtn = document.getElementById('instructionPrev');
    const nextBtn = document.getElementById('instructionNext');
    const pager   = document.getElementById('instructionPager');

    if (!section || !body) return;

    // select scenarios: <article class="scenario"> … </article>
    __instrSlides = Array.from(body.querySelectorAll('.scenario'));
    __instrIndex = 0;

    const hasSlides = __instrSlides.length > 0;

    // no scenario slides, hide nav + pager
    prevBtn.hidden = nextBtn.hidden = pager.hidden = !hasSlides || __instrSlides.length <= 1;

    // arrow keys support on the whole section
    section.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && __instrIndex > 0) {
            e.preventDefault();
            showInstructionSlide(__instrIndex - 1);
        }
        if (e.key === 'ArrowRight' && __instrIndex < __instrSlides.length - 1) {
            e.preventDefault();
            showInstructionSlide(__instrIndex + 1);
        }
    });

    // click handlers
    prevBtn.onclick = () => showInstructionSlide(__instrIndex - 1);
    nextBtn.onclick = () => showInstructionSlide(__instrIndex + 1);

    // show first or keep single content
    if (hasSlides) {
        __instrSlides.forEach((el, i) => (el.hidden = i !== 0));
        updateInstructionPager(pager);
        prevBtn.disabled = true;
        nextBtn.disabled = (__instrSlides.length <= 1);
        // Ensure the body scroll starts at top
        body.scrollTop = 0;
    } else {
        pager.textContent = '';
    }
}

function showInstructionSlide(i) {
    const body    = document.getElementById('instructionBody');
    const prevBtn = document.getElementById('instructionPrev');
    const nextBtn = document.getElementById('instructionNext');
    const pager   = document.getElementById('instructionPager');

    if (!__instrSlides.length) return;
    __instrIndex = Math.max(0, Math.min(i, __instrSlides.length - 1));

    __instrSlides.forEach((el, idx) => (el.hidden = idx !== __instrIndex));
    body.scrollTop = 0;

    prevBtn.disabled = (__instrIndex === 0);
    nextBtn.disabled = (__instrIndex === __instrSlides.length - 1);

    updateInstructionPager(pager);
}



function updateInstructionPager(pagerEl) {
    if (!pagerEl || !__instrSlides.length) return;
    const current = __instrSlides[__instrIndex];

    // select data-scenario (e.g., "E1") fallback to title text
    const code = current?.dataset?.scenario
        || current?.querySelector('.scenario-title')?.textContent?.trim()
        || `Scenario ${__instrIndex + 1}`;

    pagerEl.textContent = `${code} (${__instrIndex + 1}/${__instrSlides.length})`;
}


async function renderInstructionsForSelection() {
    const section = document.getElementById('instructionSection');
    const body = document.getElementById('instructionBody');
    const id = document.getElementById('programSelect').value;

    if (!id) {
        section.hidden = true;
        body.innerHTML = '';
        return;
    }

    const html = await fetchInstructionHtml(id);
    if (html) {
        body.innerHTML = html;
        section.hidden = false;
        initInstructionSlider();
    } else {
        section.hidden = true;
        body.innerHTML = '';
    }
}

async function fetchInstructionHtml(programId) {
    try {
        const url = `xml/instructions/${programId}.html`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return await res.text();
    } catch (_) {}

    const p = PROGRAMS.find(x => x.id === programId && x.instructions);
    return p ? `<p>${p.instructions}</p>` : null;
}

function getProgramIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('programId');
    return v ? v.trim() : null;
}

function findProgramById(id) {
    const target = String(id).toLowerCase();
    return PROGRAMS.find(p => p.id.toLowerCase() === target);
}

async function fetchProgramXmlById(id) {
    const entry = PROGRAMS.find(p => p.id === id);
    if (!entry) throw new Error('Program not found');
    const res = await fetch(entry.file, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    return await res.text();
}

function loadXmlToWorkspace(workspace, xmlString) {
    try {
        const textToDom = (Blockly.Xml.textToDom || Blockly.utils.xml.textToDom);
        const xml = textToDom(xmlString);
        Blockly.Xml.clearWorkspaceAndLoadFromXml(xml.documentElement || xml, workspace);
        requestAnimationFrame(() => {
            if (typeof workspace.scrollCenter === 'function') workspace.scrollCenter();
            if (typeof Blockly.svgResize === 'function') Blockly.svgResize(workspace);
        });
    } catch (e) {
        alert("Invalid XML format.");
        console.error(e);
    }
}

async function loadSelectedProgramIntoWorkspace(workspace) {
    const select = document.getElementById('programSelect');
    const id = select.value;
    if (!id) {
        alert('Pick a program first.');
        return;
    }
    try {
        const xml = await fetchProgramXmlById(id);
        loadXmlToWorkspace(workspace, xml);
    } catch (e) {
        console.error(e);
        alert('Could not load XML file.');
    }
}

async function autoLoadProgramFromQuery(workspace) {
    const programId = getProgramIdFromQuery();
    if (!programId) return;

    const match = findProgramById(programId);
    if (!match) {
        console.warn(`No program found for id "${programId}".`);
        return;
    }

    const select = document.getElementById('programSelect');
    select.value = match.id;

    await renderInstructionsForSelection();
    try {
        const xml = await fetchProgramXmlById(match.id);
        loadXmlToWorkspace(workspace, xml);
    } catch (e) {
        console.error(e);
    }
}


function initWorkspace() {
    // load program as html select items
    populateProgramsToDom();

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

    window.workspace = workspace;

    let nav = new NavigationController();
    nav.init();
    nav.addWorkspace(workspace);
    nav.addKeyHintListener((hints) => {
        // expects: [{key: 'W', node: 'if-do', type: 'block'}, ...]
        renderKeyboardHints(hints);
    });

    const keyOverlay = new KeyOverlay({ hideDelayMs: 5000 });
    keyOverlay.attach();

    document.getElementById("runButton").addEventListener("click", () => {
        generateCode(Blockly.getMainWorkspace());
        try {
            eval(document.getElementById("codeOutput").textContent);
        } catch (error) {
            alert("Error executing JavaScript code: " + error.message);
        }
    });

    document.getElementById("languageSelect").addEventListener("change", generateCode);
    document.getElementById("loadXmlButton").addEventListener("click", () => loadSelectedProgramIntoWorkspace(workspace));
    document.getElementById("programSelect").addEventListener("change", renderInstructionsForSelection);
    document.getElementById("showShortcuts")?.addEventListener("click", () => {
        nav?.showShortcuts();
    });

    // auto select & load program if query param is provided
    autoLoadProgramFromQuery(workspace);
    renderKeyboardHints(null);
}


// document.addEventListener('DOMContentLoaded', () => {
//   const select = document.getElementById('programSelect');
//   const btn = document.getElementById('loadXmlButton');
//
//   PROGRAMS.forEach(p => {
//     const opt = document.createElement('option');
//     opt.value = p.id;
//     opt.textContent = p.label;
//     select.appendChild(opt);
//   });
//
//   btn.addEventListener('click', loadProgramXmlToTextArea);
// });

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
