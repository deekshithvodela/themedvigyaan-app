import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Upload, Calendar, Plus, Trash2, Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [previewFile, setPreviewFile] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(-1);

  const canCreateAssignment = user.role === 'admin' || user.role === 'core';

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
      toast.error(error.response?.data?.detail || 'Failed to submit assignment');
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

  const openSubmissionPreview = (index, subList = submissions) => {
    if (index < 0 || index >= subList.length) return;
    const sub = subList[index];
    const fileUrl = sub.file_url;
    const fileName = sub.file_name || 'submission-file';
    if (!fileUrl) {
      toast.error('File URL not available');
      return;
    }
    const isData = fileUrl.startsWith('data:');
    let mime = '';
    if (isData) {
      const match = fileUrl.match(/^data:(.*?);/);
      mime = match ? match[1].toLowerCase() : '';
    } else {
      const ext = (fileName || '').split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) mime = 'image/' + ext;
      else if (ext === 'pdf') mime = 'application/pdf';
      else if (['txt', 'csv', 'json', 'md', 'js', 'py', 'html'].includes(ext)) mime = 'text/plain';
    }
    const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(fileUrl) || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
    const isPdf = mime === 'application/pdf' || /\.pdf($|\?)/i.test(fileUrl) || /\.pdf$/i.test(fileName);
    const isText = mime.startsWith('text/') || /\.(txt|csv|json|md|py|js|html)$/i.test(fileName);

    let textContent = '';
    if (isText && isData) {
      try {
        const base64Part = fileUrl.split(',')[1];
        textContent = atob(base64Part);
      } catch (e) {
        textContent = '';
      }
    }

    setPreviewIndex(index);
    setPreviewFile({
      url: fileUrl,
      name: fileName,
      mime,
      isImage,
      isPdf,
      isText,
      textContent,
      userName: sub.user_name || 'Student',
      submittedAt: sub.submitted_at
    });
  };

  const handleViewFile = (fileUrl, fileName = 'submission-file', sub = null, index = -1) => {
    if (index >= 0) {
      openSubmissionPreview(index);
      return;
    }
    if (sub) {
      const idx = submissions.findIndex(s => s.id === sub.id);
      if (idx >= 0) {
        openSubmissionPreview(idx);
        return;
      }
    }
    if (!fileUrl) {
      toast.error('File URL not available');
      return;
    }
    const isData = fileUrl.startsWith('data:');
    let mime = '';
    if (isData) {
      const match = fileUrl.match(/^data:(.*?);/);
      mime = match ? match[1].toLowerCase() : '';
    } else {
      const ext = (fileName || '').split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) mime = 'image/' + ext;
      else if (ext === 'pdf') mime = 'application/pdf';
      else if (['txt', 'csv', 'json', 'md', 'js', 'py', 'html'].includes(ext)) mime = 'text/plain';
    }
    const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(fileUrl) || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
    const isPdf = mime === 'application/pdf' || /\.pdf($|\?)/i.test(fileUrl) || /\.pdf$/i.test(fileName);
    const isText = mime.startsWith('text/') || /\.(txt|csv|json|md|py|js|html)$/i.test(fileName);

    let textContent = '';
    if (isText && isData) {
      try {
        const base64Part = fileUrl.split(',')[1];
        textContent = atob(base64Part);
      } catch (e) {
        textContent = '';
      }
    }

    setPreviewIndex(0);
    setPreviewFile({
      url: fileUrl,
      name: fileName || 'submission-file',
      mime,
      isImage,
      isPdf,
      isText,
      textContent,
      userName: sub?.user_name || 'Student',
      submittedAt: sub?.submitted_at
    });
  };

  const handlePrevSubmission = () => {
    if (previewIndex > 0) {
      openSubmissionPreview(previewIndex - 1);
    }
  };

  const handleNextSubmission = () => {
    if (previewIndex < submissions.length - 1) {
      openSubmissionPreview(previewIndex + 1);
    }
  };

  useEffect(() => {
    if (!previewFile) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSubmission();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSubmission();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile, previewIndex, submissions]);

  const handleDownloadPreviewFile = () => {
    if (!previewFile) return;
    const a = document.createElement('a');
    a.href = previewFile.url;
    a.download = previewFile.name || 'submission-file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{assignment?.title}</h1>
          <p className="text-gray-600 text-sm mb-4">Submissions ({submissions.length})</p>

          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No submissions yet</p>
              </div>
            ) : (
              submissions.map((sub, index) => (
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
                      onClick={() => openSubmissionPreview(index)}
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

        {/* In-App File Preview Modal */}
        <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) { setPreviewFile(null); setPreviewIndex(-1); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6" data-testid="file-preview-modal">
            <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 pr-6 gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-bold text-gray-800 truncate">
                  {previewFile?.name}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5 truncate" data-testid="preview-submitter-info">
                    <span className="font-semibold text-gray-800">{previewFile?.userName || 'Student'}</span>
                    {previewFile?.submittedAt && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                          {format(new Date(previewFile.submittedAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </>
                    )}
                  </div>
                </DialogDescription>
              </div>

              {/* Navigation Arrows & Download */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {submissions.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrevSubmission}
                      disabled={previewIndex <= 0}
                      className="h-7 w-7 text-gray-700 disabled:opacity-30"
                      aria-label="Previous submission"
                      title="Previous submission (Left arrow)"
                      data-testid="prev-submission-btn"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-[11px] font-medium text-gray-600 px-1.5 whitespace-nowrap" data-testid="submission-counter">
                      {previewIndex + 1} of {submissions.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNextSubmission}
                      disabled={previewIndex >= submissions.length - 1}
                      className="h-7 w-7 text-gray-700 disabled:opacity-30"
                      aria-label="Next submission"
                      title="Next submission (Right arrow)"
                      data-testid="next-submission-btn"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPreviewFile}
                  className="flex items-center gap-1.5 flex-shrink-0 h-8"
                  data-testid="preview-download-button"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden xs:inline">Download</span>
                </Button>
              </div>
            </DialogHeader>

            <div className="relative flex-1 min-h-0 overflow-y-auto py-4 flex items-center justify-center bg-slate-50/50 rounded-lg mt-2 group">
              {/* Floating side arrows on desktop/tablet */}
              {submissions.length > 1 && previewIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevSubmission}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 shadow-md border border-slate-200 p-2 rounded-full transition-all opacity-80 hover:opacity-100 z-10 hidden sm:flex items-center justify-center cursor-pointer"
                  aria-label="Previous submission"
                  data-testid="floating-prev-btn"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {submissions.length > 1 && previewIndex < submissions.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextSubmission}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 shadow-md border border-slate-200 p-2 rounded-full transition-all opacity-80 hover:opacity-100 z-10 hidden sm:flex items-center justify-center cursor-pointer"
                  aria-label="Next submission"
                  data-testid="floating-next-btn"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {previewFile?.isImage ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[68vh] max-w-full object-contain rounded shadow-sm"
                />
              ) : previewFile?.isPdf ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[68vh] rounded border border-slate-200 bg-white"
                />
              ) : previewFile?.isText && previewFile.textContent ? (
                <pre className="p-4 bg-white rounded border border-slate-200 text-xs text-gray-800 font-mono whitespace-pre-wrap max-h-[68vh] overflow-y-auto w-full">
                  {previewFile.textContent}
                </pre>
              ) : (
                <div className="text-center py-12 px-4 space-y-3">
                  <FileText className="w-16 h-16 mx-auto text-primary/40" />
                  <p className="font-semibold text-gray-800 text-sm">{previewFile?.name}</p>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Binary document preview is not supported directly in the browser. Click below to download and open with your local application.
                  </p>
                  <Button onClick={handleDownloadPreviewFile} className="mt-2">
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="assignments-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assignments</h1>
          <p className="text-gray-600 text-sm mt-1">Submit your work and track progress</p>
        </div>
        {canCreateAssignment && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-assignment-button" className="w-full sm:w-auto h-9 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="new-assignment-dialog">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Create a new assignment and assign deadlines.
                </DialogDescription>
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
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{assignment.title}</h2>
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
                        <Button variant="ghost" size="sm" aria-label="Delete assignment" data-testid={`delete-assignment-${assignment.id}`}>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Submit Your Work</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Input
                  type="file"
                  aria-label="Upload assignment submission file"
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