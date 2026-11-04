import { Component } from 'react';
import { ContentStatus } from './ContentStatus.jsx';

/**
 * Keeps a crash in one section from blanking the whole page: unexpected data
 * from the API shows the section's error message and the rest stays usable.
 */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="section container">
        <ContentStatus status="error" />
      </div>
    );
  }
}
