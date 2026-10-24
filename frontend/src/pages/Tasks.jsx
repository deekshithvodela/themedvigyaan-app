import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ListTodo, Plus, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Tasks = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignees: []
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const canCreateTask = user.role === 'admin' || user.role === 'core';
  const canEditAll = user.role === 'admin' || user.role === 'core';

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API}/tasks`);
      setTasks(res.data);
    } catch (error) {
      toast.error('Failed to fetch tasks');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const assignees = selectedUsers.map(userId => {
        const u = users.find(user => user.id === userId);
        return { user_id: userId, name: u.name, status: 'pending' };
      });

      const res = await axios.post(`${API}/tasks`, {
        ...newTask,
        assignees
      });
      
      setTasks(prev => [res.data, ...prev]);
      setNewTask({ title: '', description: '', deadline: '', assignees: [] });
      setSelectedUsers([]);
      setShowDialog(false);
      toast.success('Task created!');
    } catch (error) {
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus, assigneeUserId) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { status: newStatus, user_id: assigneeUserId });
      await fetchTasks();
      toast.success('Status updated!');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      toast.success('Task deleted');
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  return (
    <div className="space-y-6" data-testid="tasks-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Task Management</h1>
          <p className="text-gray-600 text-sm mt-1">Collaborate on tasks and track progress</p>
        </div>
        {canCreateTask && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-task-button" className="w-full sm:w-auto h-9 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-task-dialog">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Assign a new task and track progress with team members.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createTask} className="space-y-4">
                <div>
                  <Label htmlFor="task-title">Title</Label>
                  <Input
                    id="task-title"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title..."
                    required
                    data-testid="task-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task details..."
                    rows={3}
                    required
                    data-testid="task-description-input"
                  />
                </div>
                <div>
                  <Label htmlFor="task-deadline">Deadline</Label>
                  <Input
                    id="task-deadline"
                    type="datetime-local"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                    required
                    data-testid="task-deadline-input"
                  />
                </div>
                <div>
                  <Label>Assign to Users</Label>
                  <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 py-2 cursor-pointer hover:bg-slate-50 px-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.id)}
                          onChange={() => toggleUserSelection(u.id)}
                          className="w-4 h-4"
                          data-testid={`user-checkbox-${u.id}`}
                        />
                        <span className="text-sm">{u.name} ({u.email})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={loading || selectedUsers.length === 0} data-testid="create-task-button">
                  {loading ? 'Creating...' : 'Create Task'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-6">
        {tasks
          .filter(task =>
            searchQuery === '' ||
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
            data-testid={`task-${task.id}`}
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{task.title}</h3>
                  <p className="text-gray-600 text-sm">{task.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(task.deadline), 'MMM dd, yyyy')}
                  </div>
                  {canCreateTask && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Delete task" data-testid={`delete-task-${task.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this task. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTask(task.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {task.assignees?.map((assignee, idx) => {
                    const canEdit = canEditAll || assignee.user_id === user.id;
                    return (
                      <tr key={idx} data-testid={`assignee-row-${assignee.user_id}`}>
                        <td className="font-medium">{assignee.name}</td>
                        <td>
                          <span className={`status-badge ${assignee.status}`}>
                            {assignee.status || 'pending'}
                          </span>
                        </td>
                        <td>
                          {canEdit && (
                            <Select
                              value={assignee.status}
                              onValueChange={(value) => updateTaskStatus(task.id, value, assignee.user_id)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="w-32" aria-label="Select task status" data-testid={`status-select-${assignee.user_id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tasks yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;