
import { RemoteStorage } from "./remoteStorage.mjs";
import { AdminModel } from "./adminModel.mjs";


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

    this.adminModel = null;
    this.atKey = localStorage.getItem('atKey');
    if (this.atKey) {
      this.adminModel = new AdminModel(this.atKey);
    }
  }

  /*************************************************************************************/
  // Get data and start
  async start() {
    if (this.adminModel) {
      this.loginButton.hidden = true;

      await this.adminModel.fetchData();
      this.adminModel.setFilter('');

      this.editor = await this.startEditor();
      this.render();
    } else {
      localStorage.removeItem('atKey');
      this.loginButton.hidden = false;
    }
  }

  /*************************************************************************************/
  // Event handling

  async onClickedLogin() {
    this.atKey = await UIkit.modal.prompt('Enter the admin key');
    if (this.atKey) {
      this.adminModel = new AdminModel(this.atKey);
      localStorage.setItem('atKey', this.atKey);
      this.start();
    }
  }

  onFilterChange() {
    const searchString = this.searchInput.value.toLowerCase();
    this.adminModel.setFilter(searchString);
    this.renderStudentList();
  }

  async onListSelect(li, studentIndex, submissionIndex) {
    this.listEl.querySelectorAll("li").forEach(el => {
      el == li ? el.classList.add("uk-active") : el.classList.remove("uk-active")
    });
    this.selectedLi = li;
    const submission = this.adminModel.select(studentIndex, submissionIndex);

    document.getElementById("student-firstName").textContent = QuizAdmin.truncate(submission.firstName);
    document.getElementById("student-lastName").textContent = QuizAdmin.truncate(submission.lastName);
    document.getElementById("student-id").textContent = submission.studentID;
    document.getElementById("creation-time").textContent = QuizAdmin.formatedDate(submission.creationTime);

    this.scoringSelects.forEach(selectEl => {
      selectEl.disabled = false;
      selectEl.value = submission.scores[selectEl.id] || '';
      this.setSelectValue(selectEl, selectEl.value);
    });

    this.editor.setValue(submission.response);
  }

  async onScoreSelectorChange(selectEl) {
    const id = selectEl.id;
    const value = selectEl.value;
    this.setSelectValue(selectEl, value);

    if (id == 'overall') {
      this.scoringSelects.forEach(selectEl => {
        this.setSelectValue(selectEl, value);
      });
      this.selectedLi.textContent += '  \u2713';
    }

    const scores = Object.fromEntries(
      this.scoringSelects.map(selectEl => [selectEl.id, selectEl.value])
    );

    this.busySpinner.hidden = false;
    await this.adminModel.setScoresForSelection(scores)
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
    const liText = this.adminModel.students.map((student, index) => {
      const submissions = student.submissions;
      let name = student.fullName;

      // todo - add a checkmark to the name
      if (submissions.length == 1) {
        let submission = submissions[0]
        if (submission.scores.overall) {
          name += '  \u2713';
        }
        return `<li id="i-${index}-0" class="selectable-item">${name}</li>`;
      } else {
        const innerLiText = submissions.map((submission, submissionIndex) => {
          let createdStr = QuizAdmin.formatedDate(submission.creationTime);
          if (submission.scores.overall) {
            createdStr += '  \u2713';
          }
          return `<li id="i-${index}-${submissionIndex}" class="selectable-item uk-margin-left">${createdStr}</li>`;
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

