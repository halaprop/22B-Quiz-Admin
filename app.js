
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

    this.searchInput = document.getElementById('student-search');
    this.searchInput.addEventListener('input', (e) => {
      this.filteredRecords = this.filteredSubmissions();
      this.renderStudentList();
      this.selectStudent(null, null);
    });
  }

  async start() {
    if (remoteStorage) {
      this.loginButton.hidden = true;
      this.submissions = await this.fetchSubmissions();
      this.filteredRecords = this.filteredSubmissions();

      this.editor = await this.startEditor();
      this.render();
    } else {
      localStorage.removeItem('atKey');
      this.loginButton.hidden = false;
    }
  }

  // Returns [ { hashedID, submissions: [ { creationDate, firstName, lastName, ... } ] } ]
  // The submissions arrays will be ordered in time, newest first
  async fetchSubmissions() {
    const submissionIndex = {};

    const keys = await remoteStorage.keys();
    for (let key of keys) {
      const [hashedID, _] = key.split('@');
      const { value, metadata } = await remoteStorage.getItemWithMetadata(key);
      value.creationTime = new Date(metadata.creationTime);
      submissionIndex[hashedID] = [...(submissionIndex[hashedID] ?? []), value];
    }

    // Sort the keys by students' full names
    const hashedIDs = Object.keys(submissionIndex).sort((a, b) => {
      const nameA = `${a.lastName},${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName},${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const submissions = [];
    for (const hashedID of hashedIDs) {
      const sortedSubmissions = submissionIndex[hashedID].sort((a, b) => b.creationTime - a.creationTime);
      const record = { hashedID, submissions: sortedSubmissions };
      submissions.push(record);
    }
    return submissions;
  }

  filteredSubmissions() {
    const matchString = this.searchInput.value.toLowerCase();
    const maxDate = this.datePicker?.selectedDates?.[0];

    const matches = [];
    for (let record of this.submissions) {
      for (let submission of record.submissions) {
        const matchWith = `${submission.lastName}, ${submission.firstName} ${submission.studentID}`;
        const alphaMatch = matchWith.toLowerCase().includes(matchString);
        const timeMatch = maxDate ? submission.creationTime < maxDate : true;
        if (alphaMatch && timeMatch) {
          matches.push(submission);
        }
      }
    }
    return matches;
  }

  async render() {
    const onDateChange = (selectedDates, dateStr, instance) => {
      const iso = selectedDates[0]?.toISOString();
    }
    this.loginButton.hidden = true;
    this.datePicker = flatpickr("#max-date", { enableTime: true, onChange: onDateChange });
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
        this.scoringSelectChanged(selectEl);
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
    this.filteredRecords.forEach((record, index) => {
      const li = document.createElement("li");
      this.setStudentListName(li, record);
      li.style.cursor = 'pointer';
      li.addEventListener("click", () => this.selectStudent(li, index));
      this.listEl.appendChild(li);
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
      wordBasedSuggestions: false,
      readOnly: true
    });
    return editor;
  }

  // update the selector and change the selected record's score
  setSelectValue(selectEl, value) {
    const colorForValue = value => ({ '1': '#ffdddd', '2': '#ffeb99', '3': '#b3ff99' }[value] || '#ffffff');
    selectEl.value = value;
    selectEl.style.backgroundColor = colorForValue(value);
  }

  truncate(str, length = 18) {
    return str.length > length ? str.slice(0, length - 1) + '…' : str;
  };

  setStudentListName(listEl, record) {
    const check = record.scores?.overall ? '\u2713' : '';
    const fullName = `${record.lastName}, ${record.firstName}`;
    listEl.textContent = `${this.truncate(fullName, 28)}, ${check}`;
  }

  async scoringSelectChanged(selectEl) {
    if (!this.selectedRecord) return;

    const id = selectEl.id;
    const value = selectEl.value;
    this.setSelectValue(selectEl, value);
    (this.selectedRecord.scores ||= {})[selectEl.id] = value;

    // when overall is set, set any uninitialized selectors to the same value
    if (id == 'overall') {
      this.setStudentListName(this.selectedLi, this.selectedRecord);

      this.scoringSelects.forEach(selectEl => {
        if (selectEl.id !== id && selectEl.value == '') {
          this.setSelectValue(selectEl, value);
          (this.selectedRecord.scores ||= {})[selectEl.id] = value;
        }
      });
    }

    // save the selected record
    this.busySpinner.hidden = false;
    await remoteStorage.setItem(this.selectedRecord.hashedID, this.selectedRecord);
    this.busySpinner.hidden = true;
  }

  selectStudent(li, index) {
    this.listEl = document.getElementById("student-list");
    this.listEl.querySelectorAll("li").forEach(el => el.classList.remove("uk-active"));

    if (!li) {
      this.clearSelection();
    } else {
      li.classList.add("uk-active");
      this.selectedRecord = this.filteredRecords[index];
      this.selectedLi = li;
      this.renderRecord(this.selectedRecord);
      this.scoringSelects.forEach(selectEl => selectEl.disabled = false);
    }
  }

  clearSelection() {
    this.selectedRecord = null;
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

  renderRecord(record) {
    const { firstName, lastName, studentID, hashedID, response } = record;
    document.getElementById("student-firstName").textContent = this.truncate(firstName);
    document.getElementById("student-lastName").textContent = this.truncate(lastName);
    document.getElementById("student-id").textContent = studentID;
    document.getElementById("hashed-id").textContent = hashedID;

    this.rubricFields.forEach(rubricField => {
      const rubricKey = rubricField.key;
      const selectEl = this.scoringSelects.find(selectEl => selectEl.id === rubricKey);
      const value = (record.scores && record.scores[rubricKey]) || '';
      this.setSelectValue(selectEl, value);
    });

    this.editor.setValue(response);
  }
}
/*************************************************************************************************/
/*************************************************************************************************/

const quiz = new QuizAdmin();
quiz.start();



/**
 * 
    // for date filtering
    // Select the most recent submission for each (but not more recent than max creation date)

    for (const key of hashedIDs) {
      const array = submissions[key];
      if (!this.maxCreationDate) {
        responses.push(array[0]); // just take the (newest)
      } else {
        const newestBeforeMax = array.find(obj => obj.creationTime <= this.maxCreationDate);
        if (newestBeforeMax) responses.push(newestBeforeMax);
      }
    }


    // for alpha filtering

      const query = e.target.value.toLowerCase();
      const recordMatches = record => {
        const matchWith = (`${record.lastName}, ${record.firstName} ${record.studentID}`)
        return matchWith.toLowerCase().includes(query);
      };

 */