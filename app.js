
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
      this.rubricFields = ['Declaration', 'Loop', 'Conditional', 'Console Out', 'Return', 'Invocation', 'Overall' ];
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
      const check = record.Overall ? '\u2713' : '';
      li.textContent = `${record.lastName}, ${record.firstName} ${check}`;
      li.style.cursor = 'pointer';
      li.addEventListener("click", () => this.selectStudent(li, index));
      this.listEl.appendChild(li);
    });

    // rubric sliders
    let rubricHTML = '';
    this.rubricFields.forEach((rubricField, i) => {
      rubricHTML += `
        <div>
          <label for="${rubricField}" class="response-label">${rubricField}</label>
          <input id="${rubricField}" class="uk-range colored-range" type="range" min="0" max="2" step="1">
        </div>
      `;
    });
    const rubricEl = document.getElementById('rubric-div');
    rubricEl.innerHTML = rubricHTML;
    this.sliders = [...document.querySelectorAll('.colored-range')];

    this.sliders.forEach(slider => {
      slider.addEventListener('input', () => this.sliderChanged(slider));
      slider.disabled = true;
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

  async sliderChanged(slider) {
    slider.setAttribute('data-value', slider.value); // sets thumb color
    const id = slider.id;
    const value = this.slider2Model(slider.value);
    this.selectedRecord[id] = value;

    this.busySpinner.hidden = false;
    await remoteStorage.setItem(this.selectedRecord.hashedID, this.selectedRecord);

    if (id == 'Overall') {
      const fields = this.selectedRecord;
      this.selectedLi.textContent = `${fields.lastName}, ${fields.firstName} \u2713`;
    }
    this.busySpinner.hidden = true;
  }

  selectStudent(li, index) {
    this.listEl = document.getElementById("student-list");
    this.listEl.querySelectorAll("li").forEach(el => el.classList.remove("uk-active"));
    li.classList.add("uk-active");

    this.selectedRecord = this.records[index];
    this.selectedLi = li; // so we can add a check when the "Overall" slider value is set

    document.getElementById("student-firstName").textContent = this.selectedRecord.firstName;
    document.getElementById("student-lastName").textContent = this.selectedRecord.lastName;
    document.getElementById("student-id").textContent = this.selectedRecord.studentID;
    this.rubricFields.forEach(rubricField => {
      const sliderEl = this.sliders.find(slider => slider.id === rubricField);
      const value = this.selectedRecord[rubricField];
      if (value) {
        const sliderValue = this.model2Slider(value);
        sliderEl.value = sliderValue;
        sliderEl.setAttribute('data-value', sliderValue);
      } else {
        sliderEl.value = 1;
        sliderEl.setAttribute('data-value', 'white');
      }
    });
    this.sliders.forEach(slider => slider.disabled = false);
    this.editor.setValue(this.selectedRecord.response);
  }

  model2Slider(value) {
    const mapping = { L: '0', M: '1', H: '2' };
    return mapping[value] ?? null;
  }

  slider2Model(value) {
    const mapping = { '0': 'L', '1': 'M', '2': 'H' };
    return mapping[value] ?? null;
  }
}

/*************************************************************************************************/
/*************************************************************************************************/

const quiz = new QuizAdmin();
quiz.start();