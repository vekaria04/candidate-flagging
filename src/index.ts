import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/evaluate', (req, res) => {
  const c = req.body;
  const flags: any[] = [];

  // Personal Info
  ['firstName', 'lastName', 'email', 'dob'].forEach(field => {
    if (!c[field]) flags.push({ field, message: `${field} is missing`, severity: 'low' });
  });

  // Legal Status
  if (!['Permanent Resident', 'Canadian Citizen'].includes(c.legalStatus)) {
    flags.push({ field: 'legalStatus', message: 'Must be PR or Citizen', severity: 'high' });
  }

  // Driver’s License
  if (!c.hasLicense || c.hasLicense === 'No') {
    flags.push({ field: 'hasLicense', message: 'No driver’s license', severity: 'medium' });
  } else if (!['Canadian', 'International'].includes(c.licenseType)) {
    flags.push({ field: 'licenseType', message: 'Invalid or missing driver’s license type', severity: 'low' });
  }
  

  // Canadian Practice Experience
  if (!c.practiceHours || c.practiceHours < 720) {
    flags.push({ field: 'practiceHours', message: 'Less than 720 practice hours', severity: 'medium' });
  }

  // TDM
  if (!c.tdmWritten || c.tdmResult === 'Fail') {
    flags.push({ field: 'tdm', message: 'Failed or didn’t write TDM', severity: 'high' });
  }

  // PRA Attempt Elsewhere
  if (c.praOtherJurisdiction === 'Yes') {
    flags.push({ field: 'praOtherJurisdiction', message: 'PRA attempt in another jurisdiction', severity: 'low' });
  }

  // Medical Education
  if (!c.medSchool) {
    flags.push({ field: 'medSchool', message: 'Missing medical school/university name', severity: 'low' });
  }
  if (!c.medProgram) {
    flags.push({ field: 'medProgram', message: 'Missing medical degree program name', severity: 'low' });
  }
  if (!c.gradYear || isNaN(Number(c.gradYear)) || Number(c.gradYear) < 1950 || Number(c.gradYear) > new Date().getFullYear()) {
    flags.push({ field: 'gradYear', message: 'Invalid or missing graduation year', severity: 'medium' });
  }
  if (!c.educationLanguage) {
    flags.push({ field: 'educationLanguage', message: 'Missing language of education', severity: 'low' });
  }
  
  // English Proficiency 
  if (c.ielts && c.ielts < 7) {
    flags.push({ field: 'ielts', message: 'IELTS score is below 7', severity: 'medium' });
  }
  if (c.oet && !['A', 'B'].includes(c.oet.toUpperCase())) {
    flags.push({ field: 'oet', message: 'OET score is below B', severity: 'medium' });
  }
  if (c.celpip && c.celpip < 9) {
    flags.push({ field: 'celpip', message: 'CELPIP score is below 9', severity: 'medium' });
  }
  if (c.englishSpeakingPractice === 'No') {
    flags.push({ field: 'englishSpeakingPractice', message: 'No recent practice in English-speaking country', severity: 'medium' });
  }
  if (c.englishExpiredOrExceeded === 'No') {
    flags.push({ field: 'englishExpiredOrExceeded', message: 'English exam expired or didn’t exceed minimum requirement', severity: 'medium' });
  }
  if (c.activeEnglishUse === 'No') {
    flags.push({ field: 'activeEnglishUse', message: 'No active use of English', severity: 'medium' });
  }
  
  // Postgrad Training
  const pg = c.postgradMonths || 0;
  const ip = c.independentMonths || 0;
  const valid = (pg >= 24 && ip >= 24) || (pg >= 12 && ip >= 36);
  if (!valid) {
    flags.push({ field: 'postgrad', message: 'Postgrad + Independent practice does not meet minimum', severity: 'medium' });
  }

  // Exams
  if (!c.nacDate) {
    flags.push({ field: 'nacDate', message: 'Missing NAC exam date', severity: 'medium' });
  }
  if (!c.mccqe1Date && !c.lmcc) {
    flags.push({ field: 'mccqe1Date', message: 'Must have MCCQE1 date or LMCC to be eligible', severity: 'high' });
  }
  
  // Rotations
  if (!c.rotationsCompleted || c.rotationsCompleted < 7) {
    flags.push({ field: 'rotationsCompleted', message: 'Fewer than 7 rotations', severity: 'medium' });
  }

  // Impairments
  if (c.impairment === 'Yes') {
    flags.push({ field: 'impairment', message: 'Reported impairment to practice', severity: 'high' });
  }

  // Save submission locally
  const submissionsPath = path.join(__dirname, 'submissions.json');
  let submissions = [];

  try {
    const fileData = fs.readFileSync(submissionsPath, 'utf-8');
    submissions = JSON.parse(fileData);
  } catch (err) {
    submissions = []; 
  }

  submissions.push({
    timestamp: new Date().toISOString(),
    candidate: c,
    flags
  });

  fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));

  res.json({ flags });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
