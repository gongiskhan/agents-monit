/**
 * Activity Timeline Component
 * Displays stream events and hook events in chronological order
 */

import React, { useEffect, useRef, useState } from 'react';
import { StreamEvent, HookEvent, EventType } from '../types/events';

interface ActivityTimelineProps {
  streamEvents: StreamEvent[];
  hookEvents: HookEvent[];
  autoScroll?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  streamEvents,
  hookEvents,
  autoScroll = true,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Combine and sort events by timestamp
  const allEvents: Array<EventType & { id: string; isHook: boolean }> = [
    ...streamEvents.map((e, i) => ({ ...e, id: `stream-${i}`, isHook: false })),
    ...hookEvents.map((e, i) => ({ ...e, id: `hook-${i}`, isHook: true })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [allEvents.length, autoScroll]);

  const toggleExpand = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventIcon = (event: EventType & { isHook: boolean }) => {
    if (event.isHook) {
      const hookEvent = event as HookEvent;
      switch (hookEvent.hook_event_type) {
        case 'PreToolUse':
          return '🔧';
        case 'PostToolUse':
          return '✅';
        case 'UserPromptSubmit':
          return '💬';
        case 'SessionStart':
          return '🚀';
        case 'SessionEnd':
          return '🏁';
        case 'Stop':
          return '⏹️';
        default:
          return '📌';
      }
    } else {
      const streamEvent = event as StreamEvent;
      switch (streamEvent.type) {
        case 'user':
          return '👤';
        case 'assistant':
          return '🤖';
        case 'system':
          return '⚙️';
        case 'result':
          return '📊';
        default:
          return '•';
      }
    }
  };

  const getEventTitle = (event: EventType & { isHook: boolean }) => {
    if (event.isHook) {
      const hookEvent = event as HookEvent;
      return hookEvent.hook_event_type;
    } else {
      const streamEvent = event as StreamEvent;
      return streamEvent.subtype || streamEvent.type;
    }
  };

  const getEventSummary = (event: EventType & { isHook: boolean }) => {
    if (event.isHook) {
      const hookEvent = event as HookEvent;
      const payload = hookEvent.payload;

      if (hookEvent.hook_event_type === 'PreToolUse' && payload.tool_name) {
        return `Tool: ${payload.tool_name}`;
      }

      if (hookEvent.hook_event_type === 'UserPromptSubmit' && payload.prompt) {
        return payload.prompt.substring(0, 100);
      }

      return JSON.stringify(payload).substring(0, 100);
    } else {
      const streamEvent = event as StreamEvent;
      return JSON.stringify(streamEvent.data).substring(0, 100);
    }
  };

  if (allEvents.length === 0) {
    return (
      <div className="activity-timeline">
        <div className="activity-timeline-empty">
          <p>No events yet</p>
          <small>Activity will appear here as commands are executed</small>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-timeline" ref={timelineRef}>
      <div className="activity-timeline-header">
        <h2>Activity Timeline</h2>
        <span className="event-count">{allEvents.length} events</span>
      </div>

      <div className="activity-timeline-events">
        {allEvents.map((event) => {
          const isExpanded = expandedEvents.has(event.id);

          return (
            <div
              key={event.id}
              className={`event-row ${event.isHook ? 'hook-event' : 'stream-event'} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpand(event.id)}
            >
              <div className="event-row-header">
                <span className="event-icon">{getEventIcon(event)}</span>
                <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
                <span className="event-title">{getEventTitle(event)}</span>
                <span className="event-expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>

              <div className="event-row-summary">
                {getEventSummary(event)}
              </div>

              {isExpanded && (
                <div className="event-row-details">
                  <pre>{JSON.stringify(event.isHook ? (event as HookEvent).payload : (event as StreamEvent).data, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
