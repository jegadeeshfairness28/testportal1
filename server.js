import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const GITHUB_CONFIG_FILE = path.join(DATA_DIR, 'github-config.json');
const QUESTIONS_FILE = path.join(__dirname, 'questions.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const STUDENTS_DIR = path.join(DATA_DIR, 'students');
if (!fs.existsSync(STUDENTS_DIR)) {
  fs.mkdirSync(STUDENTS_DIR, { recursive: true });
}

// Helpers for data read/write
async function getSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const content = await fs.promises.readFile(SUBMISSIONS_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (err) {
    console.error('Error reading submissions:', err);
  }
  return {};
}

async function saveSubmissions(subs) {
  await fs.promises.writeFile(SUBMISSIONS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
}

async function getGithubConfig() {
  try {
    if (fs.existsSync(GITHUB_CONFIG_FILE)) {
      const content = await fs.promises.readFile(GITHUB_CONFIG_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (err) {
    console.error('Error reading github config:', err);
  }
  return {
    owner: 'jegadeeshfairness28',
    repo: 'test-portal',
    branch: 'main',
    token: process.env.GITHUB_TOKEN || ''
  };
}

async function saveGithubConfig(cfg) {
  await fs.promises.writeFile(GITHUB_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

// Helper to push a file to GitHub via REST API
async function pushFileToGitHub(owner, repo, branch, filePath, fileContent, commitMsg, token) {
  if (!token || !owner || !repo) {
    return { success: false, error: 'GitHub credentials or repository details missing.' };
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ClassTestPortal',
    'Authorization': `Bearer ${token}`
  };

  let sha = undefined;
  try {
    const getRes = await fetch(url + `?ref=${branch || 'main'}`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch (e) {
    // File may not exist yet
  }

  const base64Content = Buffer.from(fileContent).toString('base64');
  const body = {
    message: commitMsg || `Update ${filePath}`,
    content: base64Content,
    branch: branch || 'main'
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    return { success: false, error: `GitHub API error (${putRes.status}): ${errText}` };
  }

  const resData = await putRes.json();
  return { success: true, data: resData };
}

// ======================== API ROUTES ========================

// 1. Get Questions
app.get('/api/questions', async (req, res) => {
  try {
    const data = await fs.promises.readFile(QUESTIONS_FILE, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Failed to read questions.json:', err);
    res.status(500).json({ error: 'Failed to read questions' });
  }
});

// 2. Save Questions (Admin)
app.post('/api/save-questions', async (req, res) => {
  try {
    const questionsData = req.body;
    if (!questionsData || !Array.isArray(questionsData.mcq) || !Array.isArray(questionsData.programs)) {
      return res.status(400).json({ error: 'Invalid questions payload' });
    }
    const jsonStr = JSON.stringify(questionsData, null, 2);
    await fs.promises.writeFile(QUESTIONS_FILE, jsonStr, 'utf-8');

    // Also auto-sync to GitHub if configured
    const ghCfg = await getGithubConfig();
    let ghResult = null;
    if (ghCfg.token && ghCfg.owner && ghCfg.repo) {
      ghResult = await pushFileToGitHub(
        ghCfg.owner,
        ghCfg.repo,
        ghCfg.branch || 'main',
        'questions.json',
        jsonStr,
        `Update questions via Admin Portal [${new Date().toISOString()}]`,
        ghCfg.token
      );
    }

    res.json({
      success: true,
      message: 'Questions updated and saved locally' + (ghResult?.success ? ' and synced to GitHub!' : ''),
      githubSynced: ghResult?.success || false,
      githubError: ghResult?.error || null
    });
  } catch (err) {
    console.error('Error saving questions.json:', err);
    res.status(500).json({ error: 'Failed to write questions file' });
  }
});

// 3. Save Student Submission (Live autosave or Final submit)
app.post('/api/submit', async (req, res) => {
  try {
    const { roll, name, status, mcqAnswers, programAnswers, mcqScore, codeScore, totalScore, codeResults } = req.body;

    if (!roll) {
      return res.status(400).json({ error: 'Student roll number is required' });
    }

    const rollKey = String(roll).trim();
    const subs = await getSubmissions();

    const existing = subs[rollKey] || {};
    const updated = {
      ...existing,
      roll: rollKey,
      name: name || existing.name || '',
      status: status || existing.status || 'submitted',
      mcqAnswers: mcqAnswers !== undefined ? mcqAnswers : (existing.mcqAnswers || {}),
      programAnswers: programAnswers !== undefined ? programAnswers : (existing.programAnswers || {}),
      mcqScore: mcqScore !== undefined ? mcqScore : (existing.mcqScore ?? null),
      codeScore: codeScore !== undefined ? codeScore : (existing.codeScore ?? null),
      totalScore: totalScore !== undefined ? totalScore : (existing.totalScore ?? null),
      codeResults: codeResults !== undefined ? codeResults : (existing.codeResults || {}),
      updatedAt: new Date().toISOString(),
      submittedAt: status === 'submitted' ? (existing.submittedAt || new Date().toISOString()) : (existing.submittedAt || null)
    };

    subs[rollKey] = updated;
    await saveSubmissions(subs);

    // Save individual student json
    const studentFilePath = path.join(STUDENTS_DIR, `${rollKey}.json`);
    await fs.promises.writeFile(studentFilePath, JSON.stringify(updated, null, 2), 'utf-8');

    // If submitted and GitHub configured, push to GitHub
    let ghResult = null;
    if (status === 'submitted') {
      const ghCfg = await getGithubConfig();
      if (ghCfg.token && ghCfg.owner && ghCfg.repo) {
        ghResult = await pushFileToGitHub(
          ghCfg.owner,
          ghCfg.repo,
          ghCfg.branch || 'main',
          `submissions/${rollKey}.json`,
          JSON.stringify(updated, null, 2),
          `Student Submission: ${updated.name || 'Student'} (${rollKey}) - Score: ${updated.totalScore}`,
          ghCfg.token
        );
      }
    }

    res.json({
      success: true,
      data: updated,
      githubSynced: ghResult?.success || false
    });
  } catch (err) {
    console.error('Error handling submission:', err);
    res.status(500).json({ error: 'Failed to record student submission' });
  }
});

// 4. Get all student submissions (Admin)
app.get('/api/submissions', async (req, res) => {
  try {
    const subs = await getSubmissions();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve submissions' });
  }
});

// 5. Get individual student submission (Student or Admin)
app.get('/api/submissions/:roll', async (req, res) => {
  try {
    const roll = String(req.params.roll).trim();
    const subs = await getSubmissions();
    const studentSub = subs[roll];
    if (!studentSub) {
      return res.status(404).json({ error: 'No submission found for this roll number' });
    }
    res.json(studentSub);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve student submission' });
  }
});

// 6. GitHub Config Endpoints
app.get('/api/github-config', async (req, res) => {
  try {
    const cfg = await getGithubConfig();
    // Mask token for security
    const masked = {
      ...cfg,
      hasToken: !!cfg.token,
      tokenMasked: cfg.token ? `${cfg.token.slice(0, 4)}...${cfg.token.slice(-4)}` : ''
    };
    delete masked.token;
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read GitHub config' });
  }
});

app.post('/api/github-config', async (req, res) => {
  try {
    const { owner, repo, branch, token } = req.body;
    const current = await getGithubConfig();
    const updated = {
      owner: owner || current.owner || 'jegadeeshfairness28',
      repo: repo || current.repo || 'test-portal',
      branch: branch || current.branch || 'main',
      token: token !== undefined ? token : (current.token || '')
    };
    await saveGithubConfig(updated);
    res.json({ success: true, message: 'GitHub configuration updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save GitHub config' });
  }
});

// 7. Sync All Submissions to GitHub (Bulk export commit)
app.post('/api/github-sync-all', async (req, res) => {
  try {
    const ghCfg = await getGithubConfig();
    if (!ghCfg.token || !ghCfg.owner || !ghCfg.repo) {
      return res.status(400).json({
        success: false,
        error: 'Please configure your GitHub Personal Access Token (PAT), Owner, and Repo in Admin settings.'
      });
    }

    const subs = await getSubmissions();
    const subsCount = Object.keys(subs).length;

    // 1. Push combined submissions.json
    const pushSubmissions = await pushFileToGitHub(
      ghCfg.owner,
      ghCfg.repo,
      ghCfg.branch || 'main',
      'data/submissions.json',
      JSON.stringify(subs, null, 2),
      `Sync all ${subsCount} student submissions to GitHub [${new Date().toISOString()}]`,
      ghCfg.token
    );

    // 2. Push questions.json
    const questionsData = await fs.promises.readFile(QUESTIONS_FILE, 'utf-8');
    const pushQuestions = await pushFileToGitHub(
      ghCfg.owner,
      ghCfg.repo,
      ghCfg.branch || 'main',
      'questions.json',
      questionsData,
      `Sync questions.json to GitHub [${new Date().toISOString()}]`,
      ghCfg.token
    );

    // 3. Push CSV report
    const headers = ['Roll Number', 'Student Name', 'MCQ Score', 'Coding Score', 'Total Score', 'Status', 'Submitted At'];
    const csvRows = [headers.join(',')];
    Object.values(subs).forEach(r => {
      csvRows.push([
        `"${r.roll || ''}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.mcqScore ?? '-'}"`,
        `"${r.codeScore ?? '-'}"`,
        `"${r.totalScore ?? '-'}"`,
        `"${r.status || 'in-progress'}"`,
        `"${r.submittedAt || '-'}"`
      ].join(','));
    });
    await pushFileToGitHub(
      ghCfg.owner,
      ghCfg.repo,
      ghCfg.branch || 'main',
      'reports/test-results.csv',
      csvRows.join('\n'),
      `Sync test results CSV report to GitHub [${new Date().toISOString()}]`,
      ghCfg.token
    );

    res.json({
      success: true,
      message: `Successfully synchronized questions and ${subsCount} student submissions to GitHub repository (${ghCfg.owner}/${ghCfg.repo})!`,
      details: { pushSubmissions, pushQuestions }
    });
  } catch (err) {
    console.error('GitHub bulk sync error:', err);
    res.status(500).json({ error: 'Failed to synchronize with GitHub: ' + err.message });
  }
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Route for admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Class Test Portal server running on http://0.0.0.0:${PORT}`);
});
