import './AppSkeleton.css';

const AppSkeleton = () => {
    return (
        <div className="app-skeleton-container">
            {/* Header Skeleton */}
            <header className="skeleton-header">
                <div className="skeleton-logo anim-skeleton"></div>
                <div className="skeleton-profile anim-skeleton"></div>
            </header>

            {/* Main Content Skeleton */}
            <main className="skeleton-main">
                {/* Page Title Skeleton */}
                <div className="skeleton-title anim-skeleton"></div>

                {/* KPI/Stats Row Skeleton */}
                <div className="skeleton-stats-row">
                    <div className="skeleton-stat-card anim-skeleton"></div>
                    <div className="skeleton-stat-card anim-skeleton"></div>
                    <div className="skeleton-stat-card anim-skeleton"></div>
                </div>

                {/* Main Cards Skeleton */}
                <div className="skeleton-cards-grid">
                    <div className="skeleton-card anim-skeleton"></div>
                    <div className="skeleton-card anim-skeleton"></div>
                    <div className="skeleton-card anim-skeleton"></div>
                    <div className="skeleton-card anim-skeleton"></div>
                </div>
            </main>
        </div>
    );
};

export default AppSkeleton;
