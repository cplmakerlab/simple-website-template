// src/components/Experience.js
import React, { useState } from 'react';

const Experience = () => {
  const [showDescription, setShowDescription] = useState(false);

  const toggleDescription = () => {
    setShowDescription(!showDescription);
  };

  return (
    <div>
      <h2>Experience</h2>
      <div className="job">
        <h3>Job Title</h3>
        <p>Company Name | Date</p>
        <div className={`description ${showDescription ? '' : 'hidden'}`}>
          <p>Description of your responsibilities and achievements.</p>
        </div>
        <button className="toggle-btn" onClick={toggleDescription}>Toggle Description</button>
      </div>
      {/* Add more job entries as needed */}
    </div>
  );
};

export default Experience;
