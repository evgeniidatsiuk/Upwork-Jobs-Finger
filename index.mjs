import FeedSub from 'feedsub';
import {LowSync} from 'lowdb';
import {JSONFileSync} from 'lowdb/node';

// RSS Feed URL from Upwork
const upworkRssFeed = 'https://www.upwork.com/ab/feed/jobs/rss';

const db = new LowSync(new JSONFileSync('upwork_jobs.json'), {jobs: []});

// RSS Reader
const reader = new FeedSub(upworkRssFeed, {
    interval: 1, // Check feed every 1 minute.
});

reader.on('item', (item) => {
    handleNewJob(item).catch(console.error);
});

reader.on('error', (error) => {
    console.error('Error reading Upwork RSS Feed:', error);
});

// Handle new job items
async function handleNewJob(job) {
    const jobId = job.guid;

    // Check if job is already in the database
    if (!db.data.jobs.find((entry) => entry.guid === jobId)) {
        // Job is new, add it to the database and send a notification
        db.data.jobs.push({guid: jobId, title: job.title, link: job.link});
        db.write(); // Write changes to the database

        await retry(sendTelegramNotification, job, 3, 5000); // Retry 3 times with a delay of 5 seconds
    }
}

async function sendTelegramNotification(job) {
    const telegramBotToken = ''; // Replace with your Telegram bot token
    const telegramChannelId = ''; // Replace with your Telegram channel username or ID
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const message = `${job.title}\n${job.link}`;

    const body = {
        chat_id: telegramChannelId,
        text: message,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
        console.warn(`Error sending Telegram notification: ${data.description}`);
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function retry(fn, ...args) {
    let retries = 0;
    while (retries < 3) {
        try {
            return await fn(...args);
        } catch (error) {
            if (error.message.includes('Too Many Requests')) {
                console.warn('Too Many Requests: Retrying after 5 seconds...');
                await sleep(5000); // Wait for 5 seconds before retrying
                retries++;
            } else {
                throw error; // Re-throw if the error is not related to "Too Many Requests"
            }
        }
    }
}

// Start the feed reader
reader.start();

// Set up a cron job or interval to periodically check for new jobs
// Example: setInterval(() => reader.update(), 60 * 1000); // Check every 1 minute
