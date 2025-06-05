import { RemoteStorage } from "./remoteStorage.mjs";

export class AdminModel {
  constructor(remoteStorageKey) {
    this.remoteStorage = new RemoteStorage('QUIZ_RESPONSES', remoteStorageKey);
  }

  // fetch and reshape to:
  // [ { studentID, fullName, matchString, submissions: [ { scores, ... } ] } ]
  // 
  // Note - student has been scored == for any submission, sub.scores.other != ''
  async fetchData() {
    const namespace = await this.remoteStorage.getNamespace('submission', 'result');
    const submissions = [];

    const keys = Object.keys(namespace).filter(key => key.startsWith('submission'));
    for (let key of keys) {
      const { value, metadata } = namespace[key];
      const creationTime = new Date(metadata.creationTime);
      submissions.push({ ...value, creationTime, scores: {} });
    }

    const studentsByID = submissions.reduce((acc, value) => {
      const studentID = value.studentID;
      if (!acc[studentID]) {
        const fullName = `${value.lastName}, ${value.firstName}`;
        const matchString = `${fullName} ${studentID}`.toLowerCase();
        acc[value.studentID] = { studentID, fullName, matchString, submissions: [] };
      }
      acc[value.studentID].submissions.push(value);
      return acc;
    }, {});

    // for each student, sort submissions by creationTime, find scores and attach if they exist
    const students = Object.values(studentsByID);
    for (let student of students) {
      student.submissions.sort((a,b) => a.creationTime - b.creationTime);
      const scores = await this.remoteStorage.getItem(AdminModel.resultKey(student));
      if (scores) {
        student.submissions[scores.submissionIndex].scores = scores;
      }
    }
    this.students = students.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  fetchImages(keys) {
    return Promise.all(keys.map(key => this.remoteStorage.getItem(key)));
  }

  setSearchString(searchString) {
    this.searchString = searchString.toLowerCase();
  }

  filteredStudents() {
    return this.students.filter(student => {
      return student.matchString.includes(this.searchString);
    });
  }

  select(studentID, submissionIndex) {
    this.selectedStudent = this.students.find(s => s.studentID == studentID);
    this.selectedSubmissionIndex = submissionIndex;
    return this.selectedStudent.submissions[submissionIndex];
  }

  async setScoresForSelection(scores) {
    // // todo - what if another submission for the same student has scores set?

    const selectedSubmission = this.selectedStudent.submissions[this.selectedSubmissionIndex];
    scores = Object.assign(selectedSubmission.scores, scores);
    scores.submissionIndex = this.selectedSubmissionIndex;

    await this.remoteStorage.setItem(AdminModel.resultKey(this.selectedStudent), scores);
  }

  async fetchImagesForSelection() {
    const selectedSubmission = this.selectedStudent.submissions[this.selectedSubmissionIndex];
    const images = selectedSubmission.response.images;
    return await this.fetchImages(images);
  }

  static resultKey(student) {
    return `result-${student.studentID}`;
  }
}

