# Task Organizer PWA

## Overview
The Task Organizer PWA is a progressive web application designed for students to manage their tasks, including exams and assignments. The application allows users to view upcoming tasks for the week and add new tasks to a calendar, ensuring that everyone in the group stays informed.

## Features
- **Weekly Overview**: Displays all exams and assignments for the current week.
- **Calendar Integration**: Users can add tasks directly to the calendar on the selected date.
- **Real-time Updates**: Tasks added by any user are instantly visible to all users, thanks to Firebase integration.
- **Responsive Design**: Built with Bootstrap 5.3, ensuring a seamless experience on mobile devices and tablets.
- **Custom Theme**: The application features an orange color scheme with a wolf silhouette in the background of the calendar.

## Project Structure
```
task-organizer-pwa
├── src
│   ├── index.html
│   ├── css
│   │   ├── styles.css
│   │   └── bootstrap.min.css
│   ├── js
│   │   ├── app.js
│   │   ├── calendar.js
│   │   ├── tasks.js
│   │   └── firebase-config.js
│   ├── components
│   │   ├── header.js
│   │   ├── task-card.js
│   │   └── calendar-modal.js
│   └── assets
│       ├── icons
│       │   ├── icon-192x192.png
│       │   └── icon-512x512.png
│       └── images
│           └── wolf-silhouette.svg
├── manifest.json
├── sw.js
├── package.json
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/task-organizer-pwa.git
   ```
2. Navigate to the project directory:
   ```
   cd task-organizer-pwa
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage
- Open `src/index.html` in your web browser to start using the application.
- Use the calendar to add tasks and view upcoming deadlines.

## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License. See the LICENSE file for details.