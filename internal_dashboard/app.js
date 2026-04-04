/* GA4 分析ダッシュボード - Core Logic */

document.addEventListener('DOMContentLoaded', () => {
    const csvInput = document.getElementById('csv-upload');
    const loading = document.getElementById('loading');
    
    // Chart instances
    let lineChart = null;
    let barChart = null;

    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // ファイル名の表示
        document.getElementById('file-info').innerHTML = `表示中: <strong>${file.name}</strong>`;

        loading.classList.remove('hidden');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            processData(content);
            loading.classList.add('hidden');
        };
        reader.readAsText(file);
    });

    // 堅牢なCSVパース関数 (引用符対応)
    function parseCSV(text) {
        const rows = [];
        // 改行コードの正規化
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');

        for (let line of lines) {
            if (!line.trim()) continue;
            // 引用符内のカンマを保護しながら分割する正規表現
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (matches) {
                rows.push(matches.map(m => m.replace(/^"|"$/g, '').trim()));
            } else {
                // フォールバック: 単純な分割
                rows.push(line.split(',').map(s => s.trim()));
            }
        }
        return rows;
    }

    function processData(csvText) {
        const allRows = parseCSV(csvText);
        if (allRows.length === 0) return;

        // ヘッダー行を探索
        let headerIdx = -1;
        const targetKeywords = ['Date', 'Event name', 'Active users', 'セッション', 'ブラウザ', 'アクティブ ユーザー'];
        for (let i = 0; i < Math.min(allRows.length, 20); i++) {
            if (allRows[i].some(cell => targetKeywords.includes(cell))) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx === -1) {
            alert('CSVの形式が認識できません。GA4からエクスポートされた標準的な形式であることを確認してください。');
            return;
        }

        const headers = allRows[headerIdx];
        const dataRows = allRows.slice(headerIdx + 1).filter(row => row.length >= 2);
        
        // モード判定
        const hasDate = headers.includes('Date');
        
        if (hasDate) {
            handleTimeSeriesData(headers, dataRows);
        } else {
            handleAggregatedData(headers, dataRows);
        }
    }

    // --- モードA: 時系列/イベントデータ (内部利用データ等) ---
    function handleTimeSeriesData(headers, dataRows) {
        const dateIdx = headers.indexOf('Date');
        const eventIdx = headers.indexOf('Event name');
        const usersIdx = headers.indexOf('Active users');
        const countIdx = headers.indexOf('Event count');

        const dateGroups = {};
        dataRows.forEach(row => {
            const date = row[dateIdx];
            if (!date) return;
            if (!dateGroups[date]) dateGroups[date] = {};
            
            const eventName = row[eventIdx];
            if (!eventName) return;

            dateGroups[date][eventName] = {
                users: parseInt(row[usersIdx]) || 0,
                count: parseInt(row[countIdx]) || 0
            };
        });

        const sortedDates = Object.keys(dateGroups).sort();
        const latestDate = sortedDates[sortedDates.length - 1];
        const prevDate = sortedDates[sortedDates.length - 2];

        const latestData = dateGroups[latestDate];
        const currentActiveUsers = Math.max(...Object.values(latestData).map(v => v.users));
        const currentPrimaryEvents = latestData['lookup_term']?.count || 0;
        const currentSessions = latestData['session_start']?.count || 1;
        const engagementRate = (currentPrimaryEvents / currentSessions) * 100;

        let retentionRate = 0;
        if (prevDate) {
            const prevActiveUsers = Math.max(...Object.values(dateGroups[prevDate]).map(v => v.users));
            retentionRate = (currentActiveUsers / prevActiveUsers) * 100;
        }

        updateKPIs(
            currentActiveUsers.toLocaleString(),
            currentPrimaryEvents.toLocaleString(),
            engagementRate.toFixed(1) + '%',
            retentionRate.toFixed(1) + '%'
        );

        const activeUsersData = sortedDates.map(d => Math.max(...Object.values(dateGroups[d]).map(v => v.users)));
        const primaryEventsData = sortedDates.map(d => dateGroups[d]['lookup_term']?.count || 0);

        renderLineChart(sortedDates, [
            { label: 'Active Users', data: activeUsersData, color: '#007BFF' },
            { label: 'Primary Actions', data: primaryEventsData, color: '#FF4081' }
        ]);

        const eventTotals = {};
        Object.values(dateGroups).forEach(day => {
            Object.entries(day).forEach(([name, data]) => {
                eventTotals[name] = (eventTotals[name] || 0) + data.count;
            });
        });
        renderBarChart(Object.keys(eventTotals), Object.values(eventTotals), '全期間の合計アクション数');
    }

    // --- モードB: 集計データ (ブラウザ別、チャネル別等) ---
    function handleAggregatedData(headers, dataRows) {
        // カラム位置の特定（日本語/英語対応）
        const findCol = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        
        const dimIdx = 0; // 最初のカラムはディメンション
        const mainMetricIdx = findCol(['アクティブ ユーザー', 'セッション', 'Active users', 'Sessions']);
        const subMetricIdx = findCol(['エンゲージのあったセッション数', 'イベント数', 'イベント数', 'Event count']);
        const engagementIdx = findCol(['エンゲージメント率', 'Engagement rate']);

        // 全体集計（サマリー）
        let totalPrimary = 0;
        let totalSecondary = 0;
        let avgEngagement = 0;
        let count = 0;

        const labels = [];
        const mainData = [];

        dataRows.forEach(row => {
            if (row[dimIdx] === 'Total' || row[dimIdx] === '合計') return; // 合計行はスキップ
            
            const mainVal = parseFloat(row[mainMetricIdx]) || 0;
            const subVal = parseFloat(row[subMetricIdx]) || 0;
            const engVal = parseFloat(row[engagementIdx]) || 0;

            labels.push(row[dimIdx]);
            mainData.push(mainVal);

            totalPrimary += mainVal;
            totalSecondary += subVal;
            if (engVal > 0) {
                avgEngagement += engVal;
                count++;
            }
        });

        const finalEngagement = count > 0 ? (avgEngagement / count) * 100 : 0;

        updateKPIs(
            totalPrimary.toLocaleString(),
            totalSecondary.toLocaleString(),
            (finalEngagement > 100 ? finalEngagement / 100 : finalEngagement).toFixed(1) + '%',
            'N/A'
        );

        // 集計データの場合は時系列グラフが出せないので、折れ線グラフのエリアは「構成比」にする
        renderLineChart(labels, [
            { label: headers[mainMetricIdx] || '数値', data: mainData, color: '#007BFF' }
        ], 'bar'); // 折れ線グラフの代わりに棒グラフとして描画（柔軟性のため）

        renderBarChart(labels, mainData, headers[mainMetricIdx] || '数値比較');
    }

    function updateKPIs(v1, v2, v3, v4) {
        document.getElementById('kpi-users').textContent = v1;
        document.getElementById('kpi-events').textContent = v2;
        document.getElementById('kpi-engagement').textContent = v3;
        document.getElementById('kpi-retention').textContent = v4;
    }

    function renderLineChart(labels, datasets, forcedType = 'line') {
        const container = document.getElementById('lineChart');
        if (lineChart) lineChart.destroy();
        
        lineChart = new Chart(container, {
            type: forcedType,
            data: {
                labels: labels,
                datasets: datasets.map(ds => ({
                    label: ds.label,
                    data: ds.data,
                    borderColor: ds.color,
                    backgroundColor: forcedType === 'bar' ? ds.color + '88' : ds.color,
                    borderWidth: 3,
                    tension: 0.1
                }))
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    function renderBarChart(labels, data, title) {
        const container = document.getElementById('barChart');
        if (barChart) barChart.destroy();
        barChart = new Chart(container, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: ['#007BFF', '#FF4081', '#00E676', '#FFD600', '#FF9100'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        });
    }
});
