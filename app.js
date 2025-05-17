
import { RemoteStorage } from "./remoteStorage.js";

let remoteStorage;
let atKey = localStorage.getItem('atKey');

if (atKey) {
  remoteStorage = new RemoteStorage('QUIZ_RESPONSES', atKey);
}

class QuizAdmin {
  constructor() {
    this.busySpinner = document.getElementById('busy-spinner');
    this.loginButton = document.getElementById('login-btn');
    this.listEl = document.getElementById("student-list");
    this.rubricFields = [
      { label: 'Declaration', key: 'declaration' },
      { label: 'Loop', key: 'loop' },
      { label: 'Conditional', key: 'conditional' },
      { label: 'Console Out', key: 'consoleOut' },
      { label: 'Return', key: 'return' },
      { label: 'Invocation', key: 'invocation' },
      { label: 'Overall', key: 'overall' }
    ];

    this.loginButton.addEventListener('click', async () => {
      atKey = await UIkit.modal.prompt('Enter the admin key');
      if (atKey) {
        remoteStorage = new RemoteStorage('QUIZ_RESPONSES', atKey);
        localStorage.setItem('atKey', atKey);
        this.start();
      }
    });
  }

  async start() {
    if (remoteStorage) {
      this.loginButton.hidden = true;
      this.records = await this.initResults();
      this.editor = await this.startEditor();
      this.render();
    } else {
      localStorage.removeItem('atKey');
      this.loginButton.hidden = false;
    }
  }

  // return results records, first adding any missing responses
  async initResults() {
    const responses = [];
    const keys = await remoteStorage.keys();
    for (let key of keys) {
      const response = await remoteStorage.getItem(key);
      responses.push(response);
    }

    responses.sort((a, b) => {
      const nameA = `${a.lastName},${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName},${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return responses;
  }

  async render() {
    this.loginButton.hidden = true;
    // list of students
    this.listEl.innerHTML = "";
    this.records.forEach((record, index) => {
      const li = document.createElement("li");
      this.setStudentListName(li, record);
      li.style.cursor = 'pointer';
      li.addEventListener("click", () => this.selectStudent(li, index));
      this.listEl.appendChild(li);
    });

    // rubric selectors
    let rubricHTML = '';
    this.rubricFields.forEach((rubricField, i) => {
      rubricHTML += `
      <div class="grid-item">
        <div class="uk-flex uk-margin-small">
          <label class="response-label">${rubricField.label}</label>
          <select id="${rubricField.key}" class="rubric-select uk-select uk-width-auto" disabled>
            <option value="">-</option>
            <option value="3">Proficient</option>
            <option value="2">Emerging</option>
            <option value="1">Unprepared</option>
          </select>
        </div>
      </div>
      `;
    });
    const rubricEl = document.getElementById('rubric-div');
    rubricEl.innerHTML = rubricHTML;
    this.scoringSelects = [...document.querySelectorAll('.rubric-select')];

    this.scoringSelects.forEach(selectEl => {
      selectEl.addEventListener('change', (event) => {
        this.scoringSelectChanged(selectEl);
      });
    });
  }

  async startEditor() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' } });
    await new Promise(resolve => require(['vs/editor/editor.main'], resolve));

    const editor = monaco.editor.create(document.getElementById('editor-container'), {
      language: 'cpp',
      theme: 'vs-light',
      automaticLayout: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      suggestions: false,
      wordBasedSuggestions: false
    });
    return editor;
  }

  setSelectValue(selectEl, value) {
    const colorForValue = value => ({ '1': '#ffdddd', '2': '#ffeb99', '3': '#b3ff99' }[value] || '#ffffff');
    selectEl.value = value;
    selectEl.style.backgroundColor = colorForValue(value);
  }

  setStudentListName(listEl, record) {
    const check = record.scores?.overall ? '\u2713' : '';
    listEl.textContent = `${record.lastName}, ${record.firstName} ${check}`;
  }

  async scoringSelectChanged(selectEl) {
    if (!this.selectedRecord) return;

    const value = selectEl.value;
    this.setSelectValue(selectEl, value);

    const id = selectEl.id;
    (this.selectedRecord.scores ||= {})[id] = value;

    this.busySpinner.hidden = false;
    await remoteStorage.setItem(this.selectedRecord.hashedID, this.selectedRecord);

    if (id == 'overall') {
      this.setStudentListName(this.selectedLi, this.selectedRecord);
    }
    this.busySpinner.hidden = true;
  }

  selectStudent(li, index) {
    this.listEl = document.getElementById("student-list");
    this.listEl.querySelectorAll("li").forEach(el => el.classList.remove("uk-active"));
    li.classList.add("uk-active");

    this.selectedRecord = this.records[index];
    this.selectedLi = li; // so we can add a check when the "overall" score is set

    document.getElementById("student-firstName").textContent = this.selectedRecord.firstName;
    document.getElementById("student-lastName").textContent = this.selectedRecord.lastName;
    document.getElementById("student-id").textContent = this.selectedRecord.studentID;
    this.rubricFields.forEach(rubricField => {
      const rubricKey = rubricField.key
      const selectEl = this.scoringSelects.find(selectEl => selectEl.id === rubricKey);
      const value = (this.selectedRecord.scores && this.selectedRecord.scores[rubricKey]) || '';
      this.setSelectValue(selectEl, value);
    });
    this.scoringSelects.forEach(selectEl => selectEl.disabled = false);
    this.editor.setValue(this.selectedRecord.response);
  }
}

/*************************************************************************************************/
/*************************************************************************************************/

const quiz = new QuizAdmin();
quiz.start();