import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MapPin,
  Building2,
  Calendar
} from 'lucide-react';
import { api } from '../../api/client';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatShortDate(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return '';
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef(null);
  const panelRef = useRef(null);

  // Fetch unread count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.unreadNotificationCount();
      if (res && res.data && typeof res.data.unread_count === 'number') {
        setUnreadCount(res.data.unread_count);
      }
    } catch {
      // Silently ignore background polling errors
    }
  }, []);

  // Fetch notification list
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notifications({ limit: 25 });
      if (res && res.data) {
        setNotifications(res.data);
        if (res.pagination && typeof res.pagination.unread_count === 'number') {
          setUnreadCount(res.pagination.unread_count);
        }
      }
    } catch (err) {
      setError(err?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and 30-second polling interval
  useEffect(() => {
    refreshUnreadCount();

    const interval = setInterval(() => {
      refreshUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount();
        if (isOpen) fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUnreadCount, fetchNotifications, isOpen]);

  // Handle outside click and Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(item => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = (item) => {
    if (!item.read_at) {
      handleMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    } else if (item.opportunity_id) {
      navigate(`/opportunities/${item.opportunity_id}`);
    }
  };

  const displayBadge = unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount;

  return (
    <div className="notif-bell-container" ref={containerRef}>
      <button
        type="button"
        className={`icon-btn notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggleOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {displayBadge}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notif-dropdown"
          ref={panelRef}
          role="region"
          aria-label="Notification center"
        >
          <div className="notif-header">
            <div className="notif-header-title">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <span className="notif-unread-pill">{unreadCount} unread</span>
              )}
            </div>
            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-action-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          <div className="notif-body">
            {loading && notifications.length === 0 ? (
              <div className="notif-loading-state">
                <RefreshCw size={20} className="spinning" />
                <p>Checking for opportunities...</p>
              </div>
            ) : error ? (
              <div className="notif-error-state">
                <AlertTriangle size={20} color="var(--amber)" />
                <p>{error}</p>
                <button type="button" className="btn small primary" onClick={fetchNotifications}>
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon">
                  <Bell size={24} color="var(--growth)" />
                </div>
                <h4>All caught up!</h4>
                <p>You will receive notifications when new Goa opportunities or closing deadlines become available.</p>
              </div>
            ) : (
              <div className="notif-list">
                {notifications.map(item => {
                  const isUnread = !item.read_at;
                  const isClosingSoon = item.type === 'closing_soon';
                  const urgencyClass = item.urgency ? `urgency-${item.urgency}` : 'urgency-normal';

                  return (
                    <div
                      key={item.id}
                      className={`notif-item ${isUnread ? 'is-unread' : 'is-read'} ${urgencyClass}`}
                      onClick={() => handleItemClick(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                    >
                      <div className="notif-item-icon-wrapper">
                        {isClosingSoon ? (
                          <div className={`notif-icon-circle closing-soon ${urgencyClass}`}>
                            <Clock size={16} />
                          </div>
                        ) : (
                          <div className="notif-icon-circle new-opportunity">
                            <Sparkles size={16} />
                          </div>
                        )}
                      </div>

                      <div className="notif-item-content">
                        <div className="notif-item-top">
                          <span className={`notif-type-tag ${isClosingSoon ? 'tag-closing' : 'tag-new'}`}>
                            {isClosingSoon
                              ? item.urgency === '24_hours'
                                ? 'Closing in 24h'
                                : item.urgency === '3_days'
                                ? 'Closing in 3 days'
                                : 'Closing soon'
                              : 'New Opportunity'}
                          </span>
                          <span className="notif-time">{formatRelativeTime(item.created_at)}</span>
                        </div>

                        <h4 className="notif-item-title">{item.title}</h4>
                        <p className="notif-item-msg">{item.message}</p>

                        <div className="notif-item-meta">
                          {(item.organization || item.metadata?.organization) && (
                            <span className="notif-meta-chip">
                              <Building2 size={11} />
                              {item.organization || item.metadata?.organization}
                            </span>
                          )}
                          {(item.location || item.metadata?.location) && (
                            <span className="notif-meta-chip">
                              <MapPin size={11} />
                              {item.location || item.metadata?.location}
                            </span>
                          )}
                          {(item.application_deadline || item.metadata?.deadline) && isClosingSoon && (
                            <span className="notif-meta-chip deadline">
                              <Calendar size={11} />
                              Deadline: {formatShortDate(item.application_deadline || item.metadata?.deadline)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="notif-item-actions">
                        {isUnread && (
                          <button
                            type="button"
                            className="notif-read-btn"
                            title="Mark as read"
                            aria-label="Mark as read"
                            onClick={e => handleMarkAsRead(item.id, e)}
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
