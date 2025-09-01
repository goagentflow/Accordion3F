import React, { useState } from 'react';

const GanttAddTaskModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedAssets,
  tasks 
}) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(1);
  const [newTaskOwner, setNewTaskOwner] = useState('m');
  const [newTaskAssetType, setNewTaskAssetType] = useState('');
  const [insertAfterTask, setInsertAfterTask] = useState('');

  const handleSubmit = () => {
    if (newTaskName.trim() && newTaskAssetType) {
      onSubmit({
        name: newTaskName.trim(),
        duration: newTaskDuration,
        owner: newTaskOwner,
        assetType: newTaskAssetType,
        insertAfter: insertAfterTask
      });
      
      // Reset form
      setNewTaskName('');
      setNewTaskDuration(1);
      setNewTaskOwner('m');
      setNewTaskAssetType('');
      setInsertAfterTask('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-lg font-semibold mb-4">Add Custom Task</h2>
        
        {/* Asset Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Asset Type
          </label>
          <select
            value={newTaskAssetType}
            onChange={(e) => setNewTaskAssetType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Asset Type</option>
            {selectedAssets.map((asset) => (
              <option key={asset.id} value={asset.name}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Name
          </label>
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Enter task name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Duration Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (days)
          </label>
          <input
            type="number"
            value={newTaskDuration}
            onChange={(e) => setNewTaskDuration(parseInt(e.target.value) || 1)}
            min="1"
            max="365"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Owner Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner
          </label>
          <select
            value={newTaskOwner}
            onChange={(e) => setNewTaskOwner(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="m">MMM</option>
            <option value="c">Client</option>
            <option value="a">Client/Agency</option>
            <option value="l">Live Date</option>
          </select>
        </div>

        {/* Insert Position */}
        {newTaskAssetType && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insert After (optional)
            </label>
            <select
              value={insertAfterTask}
              onChange={(e) => setInsertAfterTask(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">At the beginning</option>
              {tasks
                .filter(task => task.assetType === newTaskAssetType && !task.isLiveTask)
                .map(task => (
                  <option key={task.id} value={task.id}>
                    After: {task.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newTaskName.trim() || !newTaskAssetType}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default GanttAddTaskModal;