import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Upload, Calendar, Plus, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

const Assignments = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [assignments, setAssignments] = useState([]);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', deadline: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingSubmissions, setViewingSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const canCreateAssignment = user.role === 'admin' || user.role === 'team_lead';

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await axios.get(`${API}/assignments`);
      setAssignments(res.data);
    } catch (error) {
      toast.error('Failed to fetch assignments');
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/assignments`, newAssignment);
      setAssignments(prev => [res.data, ...prev]);
      setNewAssignment({ title: '', description: '', deadline: '' });
      setShowDialog(false);
      toast.success('Assignment created!');
    } catch (error) {
      toast.error('Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const submitAssignment = async (assignmentId) => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setSubmitting(assignmentId);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await axios.post(`${API}/assignments/${assignmentId}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Assignment submitted!');
      setSelectedFile(null);
    } catch (error) {
      toast.error('Failed to submit assignment');
    } finally {
      setSubmitting(null);
    }
  };

  const deleteAssignment = async (assignmentId) => {
    try {
      await axios.delete(`${API}/assignments/${assignmentId}`);
      toast.success('Assignment deleted');
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete assignment');
    }
  };

  const viewSubmissions = async (assignmentId) => {
    try {
      const res = await axios.get(`${API}/assignments/${assignmentId}/submissions`);
      setSubmissions(res.data);
      setViewingSubmissions(assignmentId);
    } catch (error) {
      toast.error('Failed to fetch submissions');
    }
  };

  if (viewingSubmissions) {
    const assignment = assignments.find(a => a.id === viewingSubmissions);
    return (
      <div className="space-y-6" data-testid="submissions-view">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setViewingSubmissions(null)} data-testid="back-to-assignments">
            ← Back to Assignments
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{assignment?.title}</h2>
          <p className="text-gray-600 text-sm mb-4">Submissions ({submissions.length})</p>

          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No submissions yet</p>
              </div>
            ) : (
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-primary transition-colors"
                  data-testid={`submission-${sub.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{sub.user_name}</p>
                      <p className="text-sm text-gray-600 mt-1">{sub.file_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted {format(new Date(sub.submitted_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(sub.file_url, '_blank')}
                      data-testid={`view-submission-${sub.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View File
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="assignments-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assignments</h2>
          <p className="text-gray-600 text-sm mt-1">Submit your work and track progress</p>
        </div>
        {canCreateAssignment && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-assignment-button">
                <Plus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-assignment-dialog">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
              </DialogHeader>
              <form onSubmit={createAssignment} className="space-y-4">
                <div>
                  <Label htmlFor="assignment-title">Title</Label>
                  <Input
                    id="assignment-title"
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Assignment title..."
                    required
                    data-testid="assignment-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="assignment-description">Description</Label>
                  <Textarea
                    id="assignment-description"
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Assignment details..."
                    rows={4}
                    required
                    data-testid="assignment-description-input"
                  />
                </div>
                <div>
                  <Label htmlFor="assignment-deadline">Deadline</Label>
                  <Input
                    id="assignment-deadline"
                    type="datetime-local"
                    value={newAssignment.deadline}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, deadline: e.target.value }))}
                    required
                    data-testid="assignment-deadline-input"
                  />
                </div>
                <Button type="submit" disabled={loading} data-testid="create-assignment-button">
                  {loading ? 'Creating...' : 'Create Assignment'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {assignments
          .filter(assignment =>
            searchQuery === '' ||
            assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            assignment.description.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((assignment) => (
          <div
            key={assignment.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
            data-testid={`assignment-${assignment.id}`}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-start justify-between mb-4 gap-4">
              <div className="flex-1 w-full lg:w-auto">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{assignment.title}</h3>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{assignment.description}</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Due: {format(new Date(assignment.deadline), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                {canCreateAssignment && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewSubmissions(assignment.id)}
                      data-testid={`view-submissions-${assignment.id}`}
                      className="w-full sm:w-auto"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">View Submissions</span>
                      <span className="sm:hidden">Submissions</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`delete-assignment-${assignment.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this assignment and all submissions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteAssignment(assignment.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Submit Your Work</h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="flex-1"
                  data-testid={`file-input-${assignment.id}`}
                />
                <Button
                  onClick={() => submitAssignment(assignment.id)}
                  disabled={!selectedFile || submitting === assignment.id}
                  data-testid={`submit-button-${assignment.id}`}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {submitting === assignment.id ? 'Uploading...' : 'Submit'}
                </Button>
              </div>
            </div>
          </div>
        ))}

        {assignments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No assignments available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assignments;