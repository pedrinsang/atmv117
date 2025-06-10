import React from 'react';

const TaskCard = ({ task }) => {
    return (
        <div className="card mb-3" style={{ backgroundColor: '#ffcc00', border: 'none' }}>
            <div className="card-body">
                <h5 className="card-title">{task.title}</h5>
                <p className="card-text">Data: {task.date}</p>
                <p className="card-text">Descrição: {task.description}</p>
                <p className="card-text"><small className="text-muted">Adicionado por: {task.addedBy}</small></p>
            </div>
        </div>
    );
};

export default TaskCard;