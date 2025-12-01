import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { AlertCircle, Clock, CheckCircle2, PlayCircle, User, Calendar, Loader2, CheckCheck } from 'lucide-react';

interface HomeProps {
  currentUser: string;
  onSignOut: () => void;
}

interface Stage {
  id: number;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not-started' | 'in-progress' | 'completed';
  customer: string;
  createdAt: string;
  currentStage: number;
  stages: Stage[];
  waitingForReview?: boolean;
  aitNumber?: string;
  deliverableType?: string;
  category?: string;
  slaDeadline?: string;
  armId?: string;
  applicationName?: string;
  lobOwner?: string;
  aitOwner?: string;
  contacts?: string[];
}

export default function Home({ currentUser, onSignOut }: HomeProps) {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8000/ws');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setStatusMessage('Connected to server');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        switch (data.type) {
          case 'initial_state':
            if (data.tickets && data.tickets.length > 0) {
              setTickets(data.tickets);
            }
            break;

          case 'ticket_update':
            setTickets((prev) => {
              const index = prev.findIndex((t) => t.id === data.ticket.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = data.ticket;
                return updated;
              } else {
                return [...prev, data.ticket];
              }
            });

            // Update selected ticket if it's the one being updated
            if (selectedTicket && selectedTicket.id === data.ticket.id) {
              setSelectedTicket(data.ticket);
            }
            break;

          case 'processing_start':
            setStatusMessage(data.message);
            break;

          case 'stage_update':
            setStatusMessage(`${data.stage}: ${data.message}`);
            break;

          case 'processing_complete':
            setStatusMessage(data.message);
            if (data.ticket) {
              // Update the specific ticket
              setTickets((prev) => {
                const index = prev.findIndex((t) => t.id === data.ticket.id);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = data.ticket;
                  return updated;
                }
                return prev;
              });
            }
            break;

          case 'error':
            setStatusMessage(`Error: ${data.message}`);
            alert(`Error: ${data.message}`);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setStatusMessage('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        setStatusMessage('Disconnected from server');

        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load tickets on mount
  useEffect(() => {
    fetchTickets();
  }, []);

  // Handle ticket selection from URL
  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  }, [ticketId, tickets]);

  const fetchTickets = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/tickets');
      const data = await response.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const handleProcessTicket = async (ticketId: string) => {
    try {
      setStatusMessage(`Processing ticket ${ticketId}...`);

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const data = await response.json();
      console.log('Processing started:', data);
    } catch (error) {
      console.error('Error starting processing:', error);
      setStatusMessage('Failed to start processing');
      alert('Error: ' + (error as Error).message);
    }
  };

  const handleApproveReview = async (ticketId: string) => {
    try {
      setStatusMessage(`Approving review for ticket ${ticketId}...`);

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/approve-review`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to approve review');
      }

      const data = await response.json();
      console.log('Review approved:', data);
      setStatusMessage(data.message);
    } catch (error) {
      console.error('Error approving review:', error);
      setStatusMessage('Failed to approve review');
      alert('Error: ' + (error as Error).message);
    }
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    navigate(`/home/ticket/${ticket.id}`);
  };

  const handleCloseTicket = () => {
    setSelectedTicket(null);
    navigate('/home');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not-started':
        return <Clock className="w-4 h-4" />;
      case 'in-progress':
        return <PlayCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not-started':
        return 'bg-gray-100 text-gray-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500 text-white';
      case 'in-progress':
        return 'bg-blue-500 border-blue-500 text-white';
      case 'error':
        return 'bg-red-500 border-red-500 text-white';
      default:
        return 'border-gray-300 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header currentUser={currentUser} onSignOut={onSignOut} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-gray-900 mb-2">Ticket Portal</h1>
              <p className="text-gray-600">
                Manage and track your governance tickets with AI agents
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500' :
                      'bg-red-500'
                  }`} />
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Connected' :
                    connectionStatus === 'connecting' ? 'Connecting...' :
                      'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Tickets Grid */}
        <div className={`grid gap-6 ${selectedTicket ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Tickets List */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-gray-900 mb-4">
                Open Tickets ({tickets.length})
              </h2>

              {tickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No tickets available</p>
                  <p className="text-sm mt-2">Tickets will load automatically</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className={`border rounded-lg p-4 transition hover:shadow-md cursor-pointer ${selectedTicket?.id === ticket.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-semibold">{ticket.id}</span>
                          {ticket.priority === 'urgent' && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          {ticket.waitingForReview && (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700 border border-yellow-200">
                              ⏸️ Review
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs border ${getPriorityColor(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority.toUpperCase()}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${getStatusColor(
                              ticket.status
                            )}`}
                          >
                            {getStatusIcon(ticket.status)}
                            {ticket.status.replace('-', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-gray-900 mb-3 font-medium">{ticket.title}</h3>

                      <div className="flex items-center gap-4 text-gray-600 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{ticket.customer}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{ticket.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <span className="text-gray-600 text-sm">
                          Stage {ticket.currentStage + 1}/{ticket.stages.length}
                        </span>
                        <div className="flex gap-1">
                          {ticket.stages.slice(0, 8).map((stage, idx) => (
                            <div
                              key={idx}
                              className={`w-2 h-2 rounded-full ${stage.status === 'completed' ? 'bg-green-500' :
                                  stage.status === 'in-progress' ? 'bg-blue-500' :
                                    stage.status === 'error' ? 'bg-red-500' :
                                      'bg-gray-300'
                                }`}
                              title={stage.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Detail Panel */}
          {selectedTicket && (
            <div className="md:sticky md:top-24 h-fit">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-gray-900 font-bold">{selectedTicket.id}</h2>
                  <button
                    onClick={handleCloseTicket}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <h3 className="text-gray-900 mb-4 font-semibold">{selectedTicket.title}</h3>

                <div className="space-y-3 mb-6 text-sm">
                  <div>
                    <span className="text-gray-600 font-medium">Customer:</span>
                    <p className="text-gray-900">{selectedTicket.customer}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Priority:</span>
                    <p className="text-gray-900 capitalize">{selectedTicket.priority}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Status:</span>
                    <p className="text-gray-900 capitalize">{selectedTicket.status.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Created:</span>
                    <p className="text-gray-900">{selectedTicket.createdAt}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Description:</span>
                    <p className="text-gray-900">{selectedTicket.description}</p>
                  </div>
                  {selectedTicket.category && (
                    <div>
                      <span className="text-gray-600 font-medium">Category:</span>
                      <p className="text-gray-900">{selectedTicket.category}</p>
                    </div>
                  )}
                  {selectedTicket.slaDeadline && (
                    <div>
                      <span className="text-gray-600 font-medium">SLA Deadline:</span>
                      <p className="text-gray-900">{selectedTicket.slaDeadline}</p>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900 font-semibold">Agent Pipeline Progress</h3>
                    <span className="text-gray-600 text-sm">
                      {selectedTicket.currentStage + 1}/{selectedTicket.stages.length}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {selectedTicket.waitingForReview ? (
                    <button
                      onClick={() => handleApproveReview(selectedTicket.id)}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 mb-4 shadow-lg"
                    >
                      <CheckCheck className="w-5 h-5" />
                      Approve Review & Continue
                    </button>
                  ) : selectedTicket.status === 'not-started' ? (
                    <button
                      onClick={() => handleProcessTicket(selectedTicket.id)}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-4 shadow-lg"
                    >
                      <PlayCircle className="w-5 h-5" />
                      Start Processing
                    </button>
                  ) : selectedTicket.status === 'in-progress' && !selectedTicket.waitingForReview ? (
                    <button
                      onClick={() => handleProcessTicket(selectedTicket.id)}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 mb-4 shadow-lg"
                    >
                      <PlayCircle className="w-5 h-5" />
                      Resume Processing
                    </button>
                  ) : selectedTicket.status === 'completed' ? (
                    <div className="w-full bg-green-50 border border-green-200 text-green-700 py-3 rounded-lg flex items-center justify-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5" />
                      Ticket Completed
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {selectedTicket.stages.map((stage, index) => {
                      const isCompleted = stage.status === 'completed';
                      const isCurrent = stage.status === 'in-progress';
                      const isError = stage.status === 'error';

                      return (
                        <div key={stage.id} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getStageStatusColor(stage.status)}`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isCurrent ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isError ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-600'}`}>
                              {stage.name}
                            </p>
                            {stage.message && (
                              <p className={`text-sm mt-1 ${isCompleted
                                  ? 'text-green-600'
                                  : isCurrent
                                    ? 'text-blue-600'
                                    : isError
                                      ? 'text-red-600'
                                      : 'text-gray-500'
                                }`}>
                                {stage.message}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
