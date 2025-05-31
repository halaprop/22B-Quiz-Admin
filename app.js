
import { RemoteStorage } from "./remoteStorage.mjs";


class QuizAdmin {
  constructor() {
    this.busySpinner = document.getElementById('busy-spinner');
    this.loginButton = document.getElementById('login-btn');

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
    this.searchInput.addEventListener('input', e => this.onFilterChange(e));

    this.remoteStorage = null;
    this.atKey = localStorage.getItem('atKey');
    if (this.atKey) {
      this.remoteStorage = new RemoteStorage('QUIZ_RESPONSES', this.atKey);
    }
  }

  /*************************************************************************************/
  // Get data and start
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

  /*
    fetch and reshape the data to an array of objects that represent students, including a time-ordered array of their responses.
    [
      { studentID, fullName, firstName, lastName, matchString, submissions: [ { response: 'code', creationTime } ] },
      ...
    ]
  */
  async fetchSubmissions() {
    const submissions = [];

    const keys = (await this.remoteStorage.keys()).filter(key => key.startsWith('submission'));
    for (let key of keys) {
      const { value, metadata } = await this.remoteStorage.getItemWithMetadata(key);
      value.creationTime = new Date(metadata.creationTime);
      submissions.push(value);
    }

    const submissionsByID = submissions.reduce((acc, value) => {
      const { response, creationTime } = value;
      if (!acc[value.studentID]) {
        const studentID = value.studentID;
        const firstName = value.firstName;
        const lastName = value.lastName;
        const fullName = `${lastName}, ${firstName}`;
        const matchString = `${fullName} ${studentID}`.toLowerCase();

        acc[value.studentID] = { submissions: [{ response, creationTime }], studentID, fullName, firstName, lastName, matchString };
      } else {
        acc[value.studentID].submissions.push({ response, creationTime });
      }
      return acc;
    }, {});

    const result = Object.values(submissionsByID).sort((a, b) => {
      return a.fullName.localeCompare(b.fullName);
    });

    return result;
  }

  filterSubmissions() {
    const searchString = this.searchInput.value.toLowerCase();
    return this.submissions.filter(submission => {
      return !searchString || submission.matchString.includes(searchString);
    });
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
    this.onListSelect();
  }

  async onListSelect(li, studentIndex, submissionIndex) {
    let firstName = '';
    let lastName = '';
    let studentID = '';
    let creationTime = '';
    let response = '';
    let scores = {};
    this.selection = {};

    this.listEl.querySelectorAll("li").forEach(el => el.classList.remove("uk-active"));
    this.scoringSelects.forEach(selectEl => selectEl.disabled = li == null);

    if (li) {
      li.classList.add("uk-active");
      this.selection = { li, studentIndex, submissionIndex };

      const student = this.filteredSubmissions[studentIndex];
      const submission = student.submissions[submissionIndex];

      firstName = student.firstName;
      lastName = student.lastName;
      studentID = student.studentID;
      creationTime = submission.creationTime;
      response = submission.response;

      const resultKey = `result-${student.studentID}`;
      scores = await this.remoteStorage.getItem(resultKey) || {};
    }

    document.getElementById("student-firstName").textContent = QuizAdmin.truncate(firstName);
    document.getElementById("student-lastName").textContent = QuizAdmin.truncate(lastName);
    document.getElementById("student-id").textContent = studentID;
    document.getElementById("creation-time").textContent = QuizAdmin.formatedDate(creationTime);

    this.scoringSelects.forEach(selectEl => {
      selectEl.value = scores[selectEl.id] || '';
      this.setSelectValue(selectEl, selectEl.value);
    });
    this.editor.setValue(response);
  }

  async onScoreSelectorChange(selectEl) {
    const { studentIndex, submissionIndex } = this.selection;
    const student = this.filteredSubmissions[studentIndex];
    const id = selectEl.id;
    const value = selectEl.value;
    this.setSelectValue(selectEl, value);

    const resultKey = `result-${student.studentID}`;

    this.busySpinner.hidden = false;
    let scores = await this.remoteStorage.getItem(resultKey);
    if (scores) {
      if (scores.submissionIndex == submissionIndex) {
        scores[id] = value;
      } else {
        console.log('Previously graded submission index:', scores.submissionIndex, ', overwriting.');
        scores = { submissionIndex, [id]: value };
      }
    } else {
      scores = { submissionIndex, [id]: value };
    }
    await this.remoteStorage.setItem(resultKey, scores);
    this.busySpinner.hidden = true;
  }

  /*************************************************************************************/
  // Render

  static truncate(str, length = 18) {
    return str.length > length ? str.slice(0, length - 1) + '…' : str;
  }

  async render() {
    this.loginButton.hidden = true;
    this.renderStudentList();
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
    const liText = this.filteredSubmissions.map((student, studentIndex) => {
      const submissions = student.submissions;
      const name = student.fullName;
      // todo - add a checkmark to the name
      if (submissions.length == 1) {
        return `<li id="i-${studentIndex}-0" class="selectable-item">${name}</li>`;
      } else {
        const innerLiText = submissions.map((submission, submissionIndex) => {
          const createdStr = QuizAdmin.formatedDate(submission.creationTime);
          return `<li id="i-${studentIndex}-${submissionIndex}" class="selectable-item uk-margin-left">${createdStr}</li>`;
        });
        return `
          <li>
            <ul uk-accordion="multiple: true" class="uk-accordion">
              <li>
                <a class="uk-accordion-title uk-text-small">${name}</a>
                <div class="uk-accordion-content uk-margin-small-top">
                  <ul class="uk-list uk-margin-remove">
                    ${innerLiText.join('\n')}
                  </ul>
                </div>
              </li>
            </ul>
          </li>
        `;
      }
    });

    this.listEl.innerHTML = `
      <div>
        <ul class="uk-list uk-text-small">
          ${liText.join('\n')}
        </ul>
      </div>
    `;

    const items = Array.from(document.querySelectorAll('.selectable-item'));
    items.forEach(item => item.addEventListener("click", () => {
      const [_, studentIndex, submissionIndex] = item.id.split('-').map(Number);
      this.onListSelect(item, studentIndex, submissionIndex);
    }));
  }

  static formatedName(submission) {
    const check = submission.value.scores?.overall ? '  \u2713' : '';
    return `${QuizAdmin.truncate(submission.fullName, 28)}${check}`;
  }

  static formatedDate(date) {
    const options = { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true };
    return date.toLocaleString(undefined, options);
  }

  setSelectValue(selectEl, value) {
    const colorForValue = value => ({ '1': '#ffdddd', '2': '#ffeb99', '3': '#b3ff99' }[value] || '#ffffff');
    selectEl.value = value;
    selectEl.style.backgroundColor = colorForValue(value);
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
