// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, NavLink } from 'react-router-dom';
import Home from './components/Home';
import Experience from './components/Experience';
import Education from './components/Education';

import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app">
        <nav>
          <NavLink to="/" exact activeClassName="active">Home</NavLink>
          <NavLink to="/experience" activeClassName="active">Experience</NavLink>
          <NavLink to="/education" activeClassName="active">Education</NavLink>
        </nav>

        <Route path="/" exact component={Home} />
        <Route path="/experience" component={Experience} />
        <Route path="/education" component={Education} />
      </div>
    </Router>
  );
};

export default App;
