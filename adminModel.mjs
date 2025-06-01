import { RemoteStorage } from "./remoteStorage.mjs";


  // admin model should respond to
  // fetchData() gets submissions, inserting creationTime into the objects
  // setFilter
  // students (filtered array of students each with an array of submissions)
  // select(studentIndex, submissionIndex) -> { submission scores }
  // selection -> { submission scores }
  // scoresForSelection
  // setScoreForSelection(id, value)

export class AdminModel {
  constructor(remoteStorageKey) {
    this.remoteStorage = new RemoteStorage('QUIZ_RESPONSES', remoteStorageKey);
  }

  // fetch and reshape to:
  // [ { fullName, matchString, resultKey, submissions: [ { scores, ... } ] } ]
  // 
  // Note - student has been scored == for any submission, sub.scores.other != ''
  async fetchData() {
    const namespace = await this.remoteStorage.getNamespace();
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
        const resultKey = `result-${studentID}`;
        acc[value.studentID] = { fullName, matchString, resultKey, submissions: [] };
      }
      acc[value.studentID].submissions.push(value);
      return acc;
    }, {});

    // for each student, sort submissions by creationTime, find scores and attach if they exist
    const students = Object.values(studentsByID);
    for (let student of students) {
      student.submissions.sort((a,b) => a.creationTime - b.creationTime);
      const scores = await this.remoteStorage.getItem(student.resultKey);
      if (scores) {
        student.submissions[scores.submissionIndex].scores = scores;
      }
    }

    this.students = students.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  setFilter(searchString) {
    // todo
  }

  select(selectedStudentIndex, selectedSubmissionIndex) {
    this.selectedStudentIndex = selectedStudentIndex;
    this.selectedSubmissionIndex = selectedSubmissionIndex;
    return this.selectedSubmission();
  }

  selectedSubmission() {
    return this.students[this.selectedStudentIndex].submissions[this.selectedSubmissionIndex];
  }

  async setScoresForSelection(scores) {
    // todo - what if another submission for the same student has scores set?
    const selectedStudent = this.students[this.selectedStudentIndex];
    const selectedSubmission = selectedStudent.submissions[this.selectedSubmissionIndex];

    scores = Object.assign(selectedSubmission.scores, scores);
    scores.submissionIndex = this.selectedSubmissionIndex;

    const resultKey = selectedStudent.resultKey;
    await this.remoteStorage.setItem(resultKey, scores);
  }
}

