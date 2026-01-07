import { RemoteStorage } from "./remoteStorage.mjs";

const storageKey = "JhdVrtFnueFIke3Y.V41c5q/UaTMRuQI4ZZ+hvAv/K9oT8yCu6pU8BCnfHNjKqKTn/MmqpYucjOAliOhV9ZK+ZI5KnlPAnvriLgDgV+4Gg0ZA3w==";
const rs = new RemoteStorage('QUIZ_RESPONSES', storageKey);

const kCurrentYear = 2026;
const kCurrentQuarter = "winter";

// This writes a TSV report (see the col headings below) ready to paste into a google sheet.  Copy, and paste-special-> values only.
async function main() {
    try {
        const report = [];
        const namespace = await rs.getNamespace("submission");
        const submissions = Object.values(namespace).map(s => s.value);

        report.push(['firstName', 'lastName', 'studentID', '22A quarters ago', '22A grade', '22A mode', 'quiz score (3==proficient)']);

        for (let submission of submissions) {
            const { firstName, lastName, studentID, year, quarter, grade, mode } = submission;

            const scoreObject = await rs.getItem('result-' + studentID);
            const overall = scoreObject?.overall ?? 'N/A';
            const qtrsAgo = quartersAgo(year, quarter);

            report.push([firstName, lastName, studentID, qtrsAgo, grade, mode, overall]);
        }

        // Convert to TSV
        const tsv = report.map(row => row.join('\t')).join('\n');
        console.log(tsv);

    } catch (error) {
        console.error('Error generating report:', error.message);
        process.exit(1);
    }
}


// return the number of quarters ago a given quarter is
function quartersAgo(year, quarter) {
    year = parseInt(year);
    quarter = quarter.toLowerCase();

    const quarters = ['winter', 'spring', 'summer', 'fall'];

    const currentQuarterIndex = quarters.indexOf(kCurrentQuarter.toLowerCase());
    const givenQuarterIndex = quarters.indexOf(quarter);

    if (givenQuarterIndex === -1) {
        throw new Error(`Invalid quarter: ${quarter}`);
    }

    // quarters ago
    const yearDiff = kCurrentYear - year;
    const quarterDiff = currentQuarterIndex - givenQuarterIndex;

    return yearDiff * 4 + quarterDiff;
}


main();