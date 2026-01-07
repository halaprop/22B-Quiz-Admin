import { RemoteStorage } from "./remoteStorage.mjs";
import readline from 'readline';

function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer === 'YES');
        });
    });
}

async function main() {
    const question = 'This will permanently remove all quiz data. Are you sure you wish to proceed? Answer "YES" to proceed: ';
    const confirmed = await askConfirmation(question);

    if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
    }

    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const storageKey = "JhdVrtFnueFIke3Y.V41c5q/UaTMRuQI4ZZ+hvAv/K9oT8yCu6pU8BCnfHNjKqKTn/MmqpYucjOAliOhV9ZK+ZI5KnlPAnvriLgDgV+4Gg0ZA3w==";
    const rs = new RemoteStorage('QUIZ_RESPONSES', storageKey);

    try {
        console.log('Removing all quiz data...');
        const keys = await rs.keys();

        for (let i = 0; i < keys.length; i++) {
            const itemKey = keys[i];
            console.log(`Deleting ${i + 1}/${keys.length}: ${itemKey}`);
            await rs.removeItem(itemKey);
            await pause(1000);
        }

        console.log("Done. All quiz data has been removed.");
    } catch (error) {
        console.error('Error during deletion:', error.message);
        process.exit(1);
    }
}

main();