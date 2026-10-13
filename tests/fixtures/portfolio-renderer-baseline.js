function renderStudentPortfolio() {
    var sel = document.getElementById('portfolioStudentSelect');
    var contentEl = document.getElementById('portfolioContent');
    if (!sel || !contentEl) return;
    destroyWftPortfolioCharts();
    updateExportSelectedStudentButton();
    var name = sel.value;
    if (!name) {
        contentEl.innerHTML = '<div class="portfolio-empty">Select a student above to view their progress charts and session history.</div>';
        return;
    }
    if (WFT_ASYNC_PORTFOLIO_ACCESS_V1 && !isWftStorageSafeMode() && !renderStudentPortfolio._syncRender) {
        contentEl.innerHTML = '<div class="portfolio-empty">Loading student portfolio...</div>';
        loadStudentPortfolioAsync(name).then(function(studentData) {
            renderStudentPortfolio._asyncStudentData = studentData || { sessions: [] };
            renderStudentPortfolio._syncRender = true;
            try { renderStudentPortfolio(); }
            finally {
                renderStudentPortfolio._syncRender = false;
                renderStudentPortfolio._asyncStudentData = null;
            }
        }).catch(function(e) {
            wftDebugError('[AsyncPortfolio] Could not load student portfolio:', e);
            contentEl.innerHTML = '<div class="portfolio-empty">Could not load this student portfolio. Download Emergency Backup before repairing browser storage.</div>';
        });
        return;
    }
    var portfolio = renderStudentPortfolio._asyncStudentData ? null : getPortfolioData();
    var studentData = renderStudentPortfolio._asyncStudentData || (portfolio ? portfolio[name] : null);
    if (!studentData || !studentData.sessions || studentData.sessions.length === 0) {
        contentEl.innerHTML = '<div class="portfolio-empty">No sessions recorded yet for ' + escapeHtml(name) + '. Analyze a piece of their writing, then press Sync to Portfolio to save it here.</div>';
        return;
    }
    var sessions = studentData.sessions.slice().sort(function(a, b) {
        var aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        var bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return aTime - bTime;
    });
    var latestSession = sessions[sessions.length - 1];
    var prevSession = sessions.length >= 2 ? sessions[sessions.length - 2] : null;
    var overalls = sessions.map(function(session) { return session.overall != null ? Number(session.overall) : null; }).filter(function(value) { return value != null && !isNaN(value); });
    var avgOverall = overalls.length ? Math.round(overalls.reduce(function(a, b) { return a + b; }, 0) / overalls.length) : null;
    var latestOverall = latestSession.overall != null ? Number(latestSession.overall) : null;
    var prevOverall = prevSession && prevSession.overall != null ? Number(prevSession.overall) : null;
    var trend = latestOverall != null && prevOverall != null ? latestOverall - prevOverall : null;
    var bestOverall = overalls.length ? Math.max.apply(null, overalls) : null;
    var categoryAverages = getCategoryAverageMap(sessions);
    var weakestCategory = null;
    var strongestCategory = null;
    var portfolioCategoryKeys = getPortfolioCategoryKeys(sessions);
    portfolioCategoryKeys.forEach(function(key) {
        if (categoryAverages[key] == null) return;
        if (strongestCategory == null || categoryAverages[key] > categoryAverages[strongestCategory]) strongestCategory = key;
        if (weakestCategory == null || categoryAverages[key] < categoryAverages[weakestCategory]) weakestCategory = key;
    });
    var trendHtml = '';
    if (trend != null) {
        if (trend > 0) trendHtml = '<div class="stat-trend trend-up">+' + trend + '% vs last</div>';
        else if (trend < 0) trendHtml = '<div class="stat-trend trend-down">' + trend + '% vs last</div>';
        else trendHtml = '<div class="stat-trend trend-flat">Same as last</div>';
    }
    var statsHtml = '<div class="portfolio-stats-grid">'
        + '<div class="portfolio-stat-card"><div class="stat-label">Latest Score</div><div class="stat-value">' + (latestOverall != null ? latestOverall + '%' : '-') + '</div>' + trendHtml + '</div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Average Score</div><div class="stat-value">' + (avgOverall != null ? avgOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Best Score</div><div class="stat-value">' + (bestOverall != null ? bestOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Submissions</div><div class="stat-value">' + sessions.length + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Strongest Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(strongestCategory || '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Focus Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(weakestCategory || '-') + '</div></div>'
        + '</div>';

    var labels = sessions.map(function(session, i) {
        return session.date || ('Session ' + (i + 1));
    });
    var overallData = sessions.map(function(session) { return session.overall != null ? Number(session.overall) : null; });
    var chartId = 'portfolioOverallChart_' + Date.now();
    var catChartId = 'portfolioCatChart_' + Date.now();
    var colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b', '#db2777'];
    var catDatasets = portfolioCategoryKeys.map(function(key, idx) {
        var color = colors[idx % colors.length];
        return {
            label: key,
            data: sessions.map(function(session) {
                return getNumericAssessmentScore(session.categoryScores && session.categoryScores[key]);
            }),
            borderColor: color,
            backgroundColor: color + '22',
            tension: 0.35,
            fill: false,
            pointRadius: 3
        };
    });

    var sessionCardsHtml = '';
    for (var si = sessions.length - 1; si >= 0; si--) {
        var sess = sessions[si];
        var scoreColor = scoreBadgeColor(sess.overall);
        var chipsHtml = '';
        var sessionId = sess.id || sess.createdAt || String(si);
        getSessionCategoryKeys(sess).forEach(function(key) {
            var value = getNumericAssessmentScore(sess.categoryScores && sess.categoryScores[key]);
            if (value == null) value = '-';
            var chipClass = getRubricScoreColorClass(value);
            chipsHtml += '<button type="button" class="session-chip session-chip-btn ' + chipClass + '" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sessionId) + '" data-category="' + escapeHtml(key) + '" onclick="openPortfolioCategoryFeedback(this.dataset.student, this.dataset.session, this.dataset.category)"><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(String(value)) + (value !== '-' ? '/10' : '') + '</button>';
        });
        var detailedFeedbackButtonHtml = '<div class="session-feedback-actions"><button type="button" class="btn-view-detailed-feedback" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sessionId) + '" onclick="openPortfolioDetailedFeedback(this.dataset.student, this.dataset.session)">View Detailed Feedback</button></div>';
        var feedback = sess.feedbackSummary || {};
        var imageStripHtml = '';
        if (sess.images && sess.images.length) {
            imageStripHtml = '<div class="session-photo-strip">' + sess.images.map(function(image) {
                return '<div class="session-photo-thumb">'
                    + renderPortfolioSessionImageHtml(image)
                    + '<div class="thumb-caption">' + escapeHtml(image.name || 'Image') + (image.pendingDriveUpload ? '<br>Waiting to sync to Drive' : (image.driveFileId ? '<br>Stored in Drive' : '')) + '</div>'
                    + '</div>';
            }).join('') + '</div>';
        }
        sessionCardsHtml += '<div class="session-card">'
            + '<div class="session-card-header">'
            + '<div class="session-card-title-wrap"><div class="session-date">' + escapeHtml(sess.date || 'Unknown date') + '</div><span class="session-title">' + escapeHtml(sess.title || 'Untitled') + '</span></div>'
            + '<div class="session-score" style="color:' + scoreColor + ';border-color:' + scoreColor + '33;">' + (sess.overall != null ? escapeHtml(sess.overall + '%') : 'N/A') + '</div>'
            + '</div>'
            + '<div class="session-meta">Grade level: ' + escapeHtml(sess.gradeLabel || ('Grade ' + (sess.gradeLevel || 5))) + ' - ' + escapeHtml((sess.sourceType || 'typed').replace('+', ' + ')) + ' submission' + (sess.createdAt ? ' - ' + escapeHtml(new Date(sess.createdAt).toLocaleString()) : '') + ' - Writing type: ' + escapeHtml(getWritingGenreInfoFromSession(sess).mainGenre) + '</div>'
            + '<div class="session-chip-row">' + chipsHtml + '</div>'
            + detailedFeedbackButtonHtml
            + '<div class="session-artifact-grid">'
            + '<div class="session-artifact-box"><h5>Original Writing</h5><pre>' + escapeHtml(sess.originalText || '') + '</pre></div>'
            + '<div class="session-artifact-box"><h5>Corrected Writing</h5><div class="session-rich-html corrected-writing-html">' + getPortfolioCorrectedHtml(sess) + '</div></div>'
            + '<div class="session-artifact-box"><h5>Teacher Notes</h5><div class="session-rich-html">' + renderSimpleMarkdown([feedback.strength ? ('Strength: ' + feedback.strength) : '', feedback.nextTime ? ('Next step: ' + feedback.nextTime) : '', feedback.growGoal ? ('Goal: ' + feedback.growGoal) : '', feedback.closing ? ('Encouragement: ' + feedback.closing) : ''].filter(function(line) { return line; }).join('\n\n') || 'No notes saved.') + '</div></div>'
            + '</div>'
            + imageStripHtml
            + '<div class="session-card-actions">'
            + '<button type="button" class="btn-reprint" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="printPortfolioNotebookSummary(this.dataset.student, this.dataset.session)">Re-print Notebook Summary</button>'
            + '<button type="button" class="btn-reassess" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="reassessPortfolioSession(this.dataset.student, this.dataset.session)">Reassess Writing</button>'
            + '<button type="button" class="btn-delete" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="deletePortfolioSession(this.dataset.student, this.dataset.session)">Remove from Portfolio</button>'
            + '</div>'
            + '</div>';
    }

    contentEl.innerHTML = statsHtml
        + '<div class="portfolio-charts-row">'
        + '<div class="portfolio-chart-wrap"><h4>Overall Score Over Time</h4><canvas id="' + chartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '<div class="portfolio-chart-wrap"><h4>Category Scores Over Time</h4><canvas id="' + catChartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '</div>'
        + '<div class="portfolio-sessions-list"><h4>Saved Work</h4>' + sessionCardsHtml + '</div>';

    hydratePortfolioDriveImages(contentEl);

    setTimeout(function() {
        if (typeof Chart === 'undefined') {
            showWftChartUnavailableMessage(chartId);
            showWftChartUnavailableMessage(catChartId);
            return;
        }
        var validOverall = overallData.filter(function(v) { return v != null; });
        var overallMin = validOverall.length ? Math.max(0, Math.floor((Math.min.apply(null, validOverall) - 10) / 10) * 10) : 0;
        var overallMax = validOverall.length ? Math.min(100, Math.ceil((Math.max.apply(null, validOverall) + 10) / 10) * 10) : 100;
        var allCatValues = catDatasets.reduce(function(acc, ds) {
            return acc.concat(ds.data.filter(function(v) { return v != null; }));
        }, []);
        var catMin = allCatValues.length ? Math.max(0, Math.floor(Math.min.apply(null, allCatValues) - 1)) : 0;
        var catMax = allCatValues.length ? Math.min(10, Math.ceil(Math.max.apply(null, allCatValues) + 0.5)) : 10;
        var ctxOverall = document.getElementById(chartId);
        if (ctxOverall) {
            wftPortfolioChartInstances.overall = new Chart(ctxOverall, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Overall %',
                        data: overallData,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb22',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { min: overallMin, max: overallMax, ticks: { callback: function(v) { return v + '%'; } } } },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return c.parsed.y + '%'; } } } }
                }
            });
        }
        var ctxCat = document.getElementById(catChartId);
        if (ctxCat) {
            wftPortfolioChartInstances.categories = new Chart(ctxCat, {
                type: 'line',
                data: { labels: labels, datasets: catDatasets },
                options: {
                    responsive: true,
                    scales: { y: { min: catMin, max: catMax, ticks: { callback: function(v) { return v + '/10'; }, stepSize: 1 } } },
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                }
            });
        }
    }, 50);
}
