
import { RemoteStorage } from "./remoteStorage.js";


class QuizAdmin {
  constructor() {
    this.busySpinner = document.getElementById('busy-spinner');
    this.loginButton = document.getElementById('login-btn');

    const fpOptions = { enableTime: true, dateFormat: "m/d/Y, h:i K", time_24hr: false };
    this.datePicker = flatpickr('#max-date', fpOptions);

    this.searchInput = document.getElementById('student-search');
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

    this.loginButton.addEventListener('click', async () => this.onClickedLogin());
    this.datePicker.set("onChange", [(selectedDates) => this.onFilterChange(selectedDates)]);
    this.searchInput.addEventListener('input', e => this.onFilterChange(e));

    this.remoteStorage = null;
    this.atKey = localStorage.getItem('atKey');
    if (this.atKey) {
      this.remoteStorage = new RemoteStorage('QUIZ_RESPONSES', this.atKey);
    }
  }

  /*************************************************************************************/
  // Get data and start

  /*
      Data is student responses keyed by identity and time, possibly >1 responses per identity
      {
        "mi-9444@2025-05-24T20:58:07.102Z" --> { {firstName:"Bart", ... scores: { declaration: "2"} },
        ...
      }
  */

  async start() {
    if (this.remoteStorage) {
      this.loginButton.hidden = true;
      this.submissions = await this.fetchSubmissions();
      this.filteredSubmissions = this.filterSubmissions();

      this.editor = await this.startEditor();
      this.render();
    } else {
      localStorage.removeItem('atKey');
      this.loginButton.hidden = false;
    }
  }

  async fetchSubmissions() {
    const submissions = [];

    const keys = await this.remoteStorage.keys();
    for (let key of keys) {
      const { value, metadata } = await this.remoteStorage.getItemWithMetadata(key);
      const studentID = value.studentID;
      const creationTime = new Date(metadata.creationTime);
      const fullName = `${value.lastName}, ${value.firstName}`;
      const matchString = `${fullName} ${studentID}`.toLowerCase();
      submissions.push({ key, studentID, creationTime, fullName, matchString, value });
    }

    submissions.sort((a, b) => {
      const nameCompare = a.fullName.localeCompare(b.fullName);
      return nameCompare == 0 ? a.creationTime - b.creationTime : nameCompare;
    });

    return submissions;
  }

  filterSubmissions() {
    const searchString = this.searchInput.value.toLowerCase();
    const maxDate = this.datePicker?.selectedDates?.[0] ?? new Date('9999-12-31T23:59:59.999Z');
    const idIndex = new Map();

    for (const submission of this.submissions) {
      if (submission.creationTime > maxDate) continue;
      if (searchString && !submission.matchString.includes(searchString)) continue;

      const priorSubmission = idIndex.get(submission.studentID);
      if (!priorSubmission || submission.creationTime > priorSubmission.creationTime) {
        idIndex.set(submission.studentID, submission);
      }
    }
    return Array.from(idIndex.values());
  }

  /*************************************************************************************/
  // Event handling

  async onClickedLogin() {
    this.atKey = await UIkit.modal.prompt('Enter the admin key');
    if (this.atKey) {
      this.remoteStorage = new RemoteStorage('QUIZ_RESPONSES', this.atKey);
      localStorage.setItem('atKey', this.atKey);
      this.start();
    }
  }

  onFilterChange() {
    this.filteredSubmissions = this.filterSubmissions();
    this.renderStudentList();
    this.onSelectSubmission(null, null);
  }

  onSelectSubmission(li, index) {
    this.listEl = document.getElementById("student-list");
    this.listEl.querySelectorAll("li").forEach(el => el.classList.remove("uk-active"));

    if (!li) {
      this.clearSelection();
    } else {
      li.classList.add("uk-active");
      this.selectedSubmission = this.filteredSubmissions[index];
      this.selectedLi = li;
      this.renderSubmission(this.selectedSubmission);
      this.scoringSelects.forEach(selectEl => selectEl.disabled = false);
    }
  }

  async onScoreSelectorChange(selectEl) {
    if (!this.selectedSubmission) return;

    const id = selectEl.id;
    const value = selectEl.value;
    this.setSelectValue(selectEl, value);
    (this.selectedSubmission.value.scores ||= {})[selectEl.id] = value;

    // when overall is set, set any uninitialized selectors to the same value
    if (id == 'overall') {
      this.selectedLi.textContent = this.formatedName(this.selectedSubmission);

      this.scoringSelects.forEach(selectEl => {
        if (selectEl.id !== id && selectEl.value == '') {
          this.setSelectValue(selectEl, value);
          (this.selectedSubmission.value.scores ||= {})[selectEl.id] = value;
        }
      });
    }

    // save
    this.busySpinner.hidden = false;
    await this.remoteStorage.setItem(this.selectedSubmission.key, this.selectedSubmission.value);
    this.busySpinner.hidden = true;
  }

  /*************************************************************************************/
  // Render

  static truncate(str, length = 18) {
    return str.length > length ? str.slice(0, length - 1) + '…' : str;
  }

  async render() {
    const onDateChange = (selectedDates, dateStr, instance) => {
      const iso = selectedDates[0]?.toISOString();
    }
    this.loginButton.hidden = true;
    this.renderStudentList();
    // rubric selectors
    let rubricHTML = '';
    this.rubricFields.forEach(rubricField => {
      rubricHTML += this.rubricMarkup(rubricField);
    });

    document.getElementById('rubric-div').innerHTML = `
      <div class="uk-grid-collapse uk-grid-match uk-child-width-1-3@m" uk-grid style="width: 100%;">
        ${rubricHTML}
      </div>
    `;
    this.scoringSelects = [...document.querySelectorAll('.rubric-select')];
    this.scoringSelects.forEach(selectEl => {
      selectEl.addEventListener('change', (event) => {
        this.onScoreSelectorChange(selectEl);
      });
    });
  }

  rubricMarkup(rubricField) {
    return `
      <div class="uk-flex uk-flex-middle" style="height: 2.5rem;">
        <div style="flex: 0 0 50%; text-align: right; padding-right: 0.5rem;">
          <label for="${rubricField.key}" class="uk-form-label response-label">${rubricField.label}</label>
        </div>
        <div style="flex: 0 0 50%; text-align: left; padding-left: 0.5rem;">
          <select id="${rubricField.key}" class="uk-select uk-width-auto rubric-select" disabled>
            <option value="">-</option>
            <option value="3">Proficient</option>
            <option value="2">Emerging</option>
            <option value="1">Unprepared</option>
          </select>
        </div>
      </div>
    `;
  }

  renderStudentList() {
    this.listEl.innerHTML = "";
    this.filteredSubmissions.forEach((submission, index) => {
      const li = document.createElement("li");
      li.textContent = this.formatedName(submission);
      li.style.cursor = 'pointer';
      li.addEventListener("click", () => this.onSelectSubmission(li, index));
      this.listEl.appendChild(li);
    });
  }

  formatedName(submission) {
    const check = submission.value.scores?.overall ? '  \u2713' : '';
    return `${QuizAdmin.truncate(submission.fullName, 28)}${check}`;
  }

  formatedDate(date) {
    const options = { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true };
    return date.toLocaleString(undefined, options);
  }

  renderSubmission(submission) {
    const { firstName, lastName, studentID, hashedID, response, scores } = submission.value;
    document.getElementById("student-firstName").textContent = QuizAdmin.truncate(firstName);
    document.getElementById("student-lastName").textContent = QuizAdmin.truncate(lastName);
    document.getElementById("student-id").textContent = studentID;
    document.getElementById("hashed-id").textContent = hashedID;
    document.getElementById("creation-time").textContent = this.formatedDate(submission.creationTime);

    this.rubricFields.forEach(rubricField => {
      const rubricKey = rubricField.key;
      const selectEl = this.scoringSelects.find(selectEl => selectEl.id === rubricKey);
      const value = (scores && scores[rubricKey]) || '';
      this.setSelectValue(selectEl, value);
    });
    this.editor.setValue(response);
  }

  setSelectValue(selectEl, value) {
    const colorForValue = value => ({ '1': '#ffdddd', '2': '#ffeb99', '3': '#b3ff99' }[value] || '#ffffff');
    selectEl.value = value;
    selectEl.style.backgroundColor = colorForValue(value);
  }

  clearSelection() {
    this.selectedSubmission = null;
    this.selectedLi = null;

    ['student-firstName', 'student-lastName', 'student-id', 'hashed-id'].forEach(id => {
      document.getElementById(id).textContent = '';
    });

    // Clear rubric fields
    this.rubricFields.forEach(rubricField => {
      const selectEl = this.scoringSelects.find(selectEl => selectEl.id === rubricField.key);
      this.setSelectValue(selectEl, '');
      selectEl.disabled = true;
    });
    this.editor.setValue('');
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
      wordBasedSuggestions: false,
      readOnly: true
    });
    return editor;
  }

}
/*************************************************************************************************/
/*************************************************************************************************/

const quiz = new QuizAdmin();
quiz.start();
