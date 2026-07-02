# ProfPilot Product Brief

ProfPilot is an AI-assisted professor workflow platform.

The core idea is to help professors manage exams, consultations, and graduation projects in one place. AI supports the professor by reviewing, summarizing, and suggesting. AI must not replace professor judgment.

## Core Principles

- AI must not generate exams.
- AI must not grade students.
- Student clients must never receive correct answers or grading logic.
- Exam questions, answers, grading logic, and student data must stay on the server.
- The Live USB environment must only provide a common exam browser environment.
- Keep the MVP simple, demo-friendly, and easy to explain.

## Main Flows

### 1. Professor Dashboard

The professor logs in and sees a dashboard with the most important work for the day.

Dashboard should show:

- Exams needing review
- Today's consultations
- Graduation project risk teams
- AI summary of today's tasks

### 2. Exam Flow

The professor creates and manages exams manually.

Professor actions:

- Create an exam.
- Manually add questions.
- Attach question images if needed.
- Ask AI to review questions.
- Publish the exam.
- Receive a generated exam code.
- Register allowed students.
- Review submitted results.
- Manually grade essay questions.
- Release results later if needed.

Supported question types:

- Multiple choice
- OX
- Short answer
- Essay

AI question review may check for:

- Typos
- Unclear wording
- Duplicate choices
- Possible answer conflicts
- Difficulty opinion

Student exam flow:

- Student boots into the exam environment or opens the student exam page.
- Student enters `student_id` and `exam_code`.
- Server checks that:
  - The exam code exists.
  - The exam is open.
  - The student is allowed.
  - The student has not already submitted.
- Student takes the exam.
- Student submits answers.
- Server stores submitted answers.
- Server grades objective questions.
- Essay questions remain pending manual grading.

Security requirements:

- Client must never receive correct answers.
- Client must never receive grading logic.
- Server is the source of truth for exam access, submissions, and grading.

### 3. Consultation Flow

Students request consultations and professors manage approvals and notes.

Flow:

- Student requests a consultation.
- Student selects date/time and writes a reason.
- Professor approves or rejects the request.
- Approved consultation can be added to a calendar using an ICS file or Google Calendar.
- Professor writes a consultation note after the meeting.
- AI summarizes the note and extracts action items.

### 4. Graduation Project Flow

Professors manage graduation project teams and monitor progress.

Flow:

- Professor creates graduation project teams.
- Students submit weekly reports.
- Students update progress and links.
- Professor views team status.
- System marks risk teams.
- AI summarizes weekly reports and drafts professor feedback.

Risk team conditions:

- No weekly report
- Low progress
- No update for 14 days

### 5. Live USB Demo Flow

The Live USB is only a controlled exam access environment.

The USB must not contain:

- Exam questions
- Correct answers
- Grading logic
- Student data

Boot flow:

- USB boots into the common exam environment.
- Browser opens the exam web page in kiosk mode.
- Student enters `student_id` and `exam_code`.
- Exam data is fetched from the server after validation.

## MVP Scope

The MVP should focus on demo-friendly professor workflows:

- Professor dashboard
- Manual exam creation
- AI question review assistance
- Exam publishing with exam code
- Allowed student registration
- Student exam entry and submission
- Server-side objective grading
- Manual essay grading
- Consultation request approval and notes
- AI consultation note summary
- Graduation team tracking
- Risk team detection
- AI weekly report summary and feedback draft
- Live USB demo concept where the USB only opens the server exam page

## Out Of Scope For MVP

- AI-generated exams
- AI final grading of students
- Offline exam data stored on USB
- Client-side answer checking
- Complex LMS integrations
- Full production proctoring system
