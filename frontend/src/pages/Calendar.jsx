import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Edit, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Calendar = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [events, setEvents] = useState([]);
  const [nativeEvents, setNativeEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  const isAdminOrCore = user.role === 'admin' || user.role === 'core';

  useEffect(() => {
    fetchEvents();
    if (isAdminOrCore) {
      fetchNativeEvents();
    }
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/calendar/events`);
      setEvents(res.data);
    } catch (error) {
      toast.error('Failed to fetch calendar events');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNativeEvents = async () => {
    try {
      const res = await axios.get(`${API}/calendar/native-events`);
      setNativeEvents(res.data);
    } catch (error) {
      console.error('Failed to fetch native events:', error);
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/calendar/native-events`, newEvent);
      toast.success('Event created!');
      setNewEvent({ title: '', description: '', start_date: '', end_date: '' });
      setShowDialog(false);
      await fetchEvents();
      if (isAdminOrCore) await fetchNativeEvents();
    } catch (error) {
      toast.error('Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await axios.delete(`${API}/calendar/native-events/${eventId}`);
      toast.success('Event deleted!');
      await fetchEvents();
      if (isAdminOrCore) await fetchNativeEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const groupedEvents = events
    .filter(event =>
      searchQuery === '' ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .reduce((acc, event) => {
      const date = format(parseISO(event.start), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Calendar</h1>
          <p className="text-gray-600 text-sm mt-1">View upcoming events and schedules</p>
        </div>
        {isAdminOrCore && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-event-button" className="w-full sm:w-auto h-9 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Calendar Event</DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Schedule a meeting, presentation, or academic event.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createEvent} className="space-y-4">
                <div>
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title..."
                    required
                    data-testid="event-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Event details..."
                    rows={3}
                    data-testid="event-description-input"
                  />
                </div>
                <div>
                  <Label htmlFor="event-start">Start Date & Time</Label>
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    data-testid="event-start-input"
                  />
                </div>
                <div>
                  <Label htmlFor="event-end">End Date & Time</Label>
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                    data-testid="event-end-input"
                  />
                </div>
                <Button type="submit" disabled={loading} data-testid="create-event-button">
                  {loading ? 'Creating...' : 'Create Event'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming events</p>
            {isAdminOrCore && <p className="text-sm mt-2">Create your first event using the button above</p>}
          </div>
        ) : (
          Object.entries(groupedEvents)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, dayEvents]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-white rounded-lg px-3 py-2 text-center min-w-[60px]">
                    <div className="text-2xl font-bold">
                      {format(parseISO(date), 'd')}
                    </div>
                    <div className="text-xs uppercase">
                      {format(parseISO(date), 'MMM')}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {format(parseISO(date), 'EEEE')}
                  </div>
                </div>

                <div className="grid gap-3 ml-0 sm:ml-[76px]">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
                      style={{ borderLeftWidth: '4px', borderLeftColor: event.calendar_color }}
                      data-testid={`event-${event.id}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800">{event.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" style={{ color: event.calendar_color, borderColor: event.calendar_color }}>
                            {event.calendar_label}
                          </Badge>
                          {isAdminOrCore && event.source === 'native' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="Delete event" data-testid={`delete-event-${event.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this event.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteEvent(event.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>

                      {event.description && (
                        <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(parseISO(event.start), 'h:mm a')}
                          {event.end && ` - ${format(parseISO(event.end), 'h:mm a')}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Calendar;
