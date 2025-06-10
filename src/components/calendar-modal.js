import React, { useState } from 'react';

const CalendarModal = ({ isOpen, onClose, onAddTask }) => {
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDate, setTaskDate] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (taskTitle && taskDate) {
            onAddTask({ title: taskTitle, date: taskDate });
            setTaskTitle('');
            setTaskDate('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog">
            <div className="modal-dialog" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Adicionar Tarefa</h5>
                        <button type="button" className="close" onClick={onClose}>
                            <span>&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="taskTitle">Título da Tarefa</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="taskTitle"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="taskDate">Data da Tarefa</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    id="taskDate"
                                    value={taskDate}
                                    onChange={(e) => setTaskDate(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">Adicionar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarModal;