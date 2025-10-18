# Project Overview

This project is a web-based timeline builder application. It allows users to create and visualize project timelines, particularly for marketing campaigns. The application is built using React and utilizes Tailwind CSS for styling.

The core functionality of the application revolves around parsing a CSV file (`Group_Asset_Task_Timev.2 Inc You_Weekend.csv`) that contains information about different assets and their associated tasks and durations. Users can select assets, specify "go-live" dates, and the application will automatically generate a timeline, calculating the start and end dates for each task based on its duration and dependencies.

The timeline is displayed as a Gantt chart, providing a clear visual representation of the project schedule. The application also includes features for:

*   **Customizing timelines:** Users can add custom tasks, edit task names, and adjust task durations.
*   **Handling non-working days:** The application accounts for weekends and bank holidays when calculating timelines.
*   **Undo/Redo functionality:** Users can easily undo and redo their actions.
*   **Exporting timelines:** The generated timeline can be exported to an Excel file.

## Building and Running

To build and run this project, you will need to have Node.js and npm installed on your machine.

**1. Install Dependencies:**

```bash
npm install
```

**2. Start the Development Server:**

```bash
npm start
```

This will start the development server and open the application in your default web browser at `http://localhost:3000`.

**3. Build for Production:**

```bash
npm run build
```

This will create a `build` directory with the production-ready files.

**4. Run Tests:**

```bash
npm test
```

This will launch the test runner in interactive watch mode.

## Development Conventions

*   **Component-Based Architecture:** The application follows a component-based architecture, with components located in the `src/components` directory.
*   **State Management:** The main application state is managed in the `TimelineBuilder.js` component using React hooks (`useState`, `useEffect`).
*   **Styling:** The application uses Tailwind CSS for styling. Utility classes are used directly in the JSX of the components.
*   **File Naming:** Component files are named using PascalCase (e.g., `TimelineBuilder.js`).
*   **Code Style:** The code follows standard JavaScript and React conventions. The existing code is well-formatted and includes comments where necessary to explain complex logic.
*   **Hooks:** The project utilizes custom hooks, such as `useDebounce`, which is located in the `src/hooks` directory.
