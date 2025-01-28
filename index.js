const API_KEY = process.env.API_KEY;
let standingsData = {};
const modal = document.getElementById('boxscore-modal');
const closeBtn = document.querySelector('.close');
const boxscoreContent = document.getElementById('boxscore-content');

document.getElementById('current-date').textContent = 
    new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (event) => {
    if (event.target === modal) modal.style.display = 'none';
};

async function fetchStandings() {
    const url = 'https://nba-api-free-data.p.rapidapi.com/nba-league-standings?year=2025';
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': 'nba-api-free-data.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        standingsData = {};

        data.response.standings.entries.forEach(team => {
            const teamId = team.team.id;
            standingsData[teamId] = {
                wins: team.stats.find(s => s.name === 'wins')?.value || 0,
                losses: team.stats.find(s => s.name === 'losses')?.value || 0
            };
        });
    } catch (error) {
        console.error('Error fetching standings:', error);
    }
}

async function fetchGames() {
    const gamesContainer = document.getElementById('games');
    gamesContainer.innerHTML = `<div class="spinner"></div>`;

    await fetchStandings();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const apiDate = `${tomorrow.getFullYear()}${(tomorrow.getMonth()+1)
                .toString().padStart(2,'0')}${tomorrow.getDate()
                .toString().padStart(2,'0')}`;

    const url = `https://nba-api-free-data.p.rapidapi.com/nba-schedule-by-date?date=${apiDate}`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': 'nba-api-free-data.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        const validGames = (data?.response?.Events || [])
            .filter(game => game?.status?.detail !== 'Postponed');

        displayGames(validGames);
    } catch (error) {
        gamesContainer.innerHTML = `
            <div class="tile" style="color: #ff6f61">
                ${error.message}.<br>
                Try <a href="javascript:location.reload()">refreshing</a>.
            </div>`;
        console.error('Error:', error);
    }
}

function displayGames(games) {
    const gamesContainer = document.getElementById('games');
    gamesContainer.innerHTML = '';

    if (!games?.length) {
        gamesContainer.innerHTML = `
            <div class="tile" style="animation: fadeIn 0.6s">
                <div style="text-align: center; padding: 20px">
                    🏀 No games scheduled today
                </div>
            </div>
        `;
        return;
    }

    games.forEach((game, index) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.style.animationDelay = `${index * 0.1}s`;
        tile.dataset.gameId = game.id;

        const homeTeam = game.competitors?.find(t => t?.isHome);
        const awayTeam = game.competitors?.find(t => !t?.isHome);
        const gameDate = game?.date ? new Date(game.date) : new Date();

        let gameDetails = gameDate.toLocaleTimeString('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            minute: '2-digit'
        }) + ' PST';

        const homeRecord = standingsData[homeTeam?.id] || { wins: '-', losses: '-' };
        const awayRecord = standingsData[awayTeam?.id] || { wins: '-', losses: '-' };

        let statusClass = '';
        let statusText = '';
        let gameStatusState = game?.status.state;
        
        if (gameStatusState === 'in') {
            statusClass = 'status-in-progress';
            statusText = 'Live';
            gameDetails = game?.status.detail;
        } 
        else if (gameStatusState === 'post') {
            statusClass = 'status-final';
            statusText = 'Final';
        }
        else
        {
        statusClass = 'status-scheduled';
            statusText = 'Scheduled';
        }

    const awayScore = parseInt(awayTeam?.score) || 0;
    const homeScore = parseInt(homeTeam?.score) || 0;
    const awayIsLoser = gameStatusState === 'post' && awayScore < homeScore;
    const homeIsLoser = gameStatusState === 'post' && homeScore < awayScore;
        
        tile.innerHTML = `
        <div class="status-tag ${statusClass}">${statusText}</div>
        <div class="team-info">
            <div class="team-card ${awayIsLoser ? 'loser' : ''}">
                <div class="logo-container">
                    <img class="team-logo" src="${awayTeam?.logo || ''}" 
                        alt="${awayTeam?.displayName || 'Away Team'}">
                </div>
                <div class="team-name">${awayTeam?.displayName || 'Away Team'}</div>
                <div class="team-record">${awayRecord.wins}-${awayRecord.losses}</div>
                <div class="score">${awayTeam?.score || '-'}</div>
            </div>
            
            <div class="vs-container">
                <div class="vs-text">VS</div>
                <div class="game-details">${gameDetails}</div>
            </div>

            <div class="team-card ${homeIsLoser ? 'loser' : ''}">
                <div class="logo-container">
                    <img class="team-logo" src="${homeTeam?.logo || ''}" 
                        alt="${homeTeam?.displayName || 'Home Team'}">
                </div>
                <div class="team-name">${homeTeam?.displayName || 'Home Team'}</div>
                <div class="team-record">${homeRecord.wins}-${homeRecord.losses}</div>
                <div class="score">${homeTeam?.score || '-'}</div>
            </div>
        </div>
    `;

        tile.addEventListener('click', async () => {
            try {
                const gameId = tile.dataset.gameId;
                if (!gameId) throw new Error('No game ID available');

                modal.style.display = 'block';
                boxscoreContent.innerHTML = `<div class="spinner"></div>`;

                const response = await fetch(`https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId=${gameId}`);
                console.log(gameId);
                const data = await response.json();
                console.log(data.gamepackageJSON.boxscore);
                
                if (!data.gamepackageJSON.boxscore) throw new Error('No boxscore data available');
                displayBoxscore(data);
            } catch (error) {
                boxscoreContent.innerHTML = `
                    <div class="error">
                        Error loading boxscore: ${error.message}
                    </div>
                `;
            }
        });

        gamesContainer.appendChild(tile);
    });
}

function displayBoxscore(data) {
    try {
        const boxscore = data.gamepackageJSON.boxscore;
        const { teams, players } = boxscore;
        let content = '';

        // Find home and away teams
        const homeTeam = teams.find(t => t.homeAway === 'home').team;
        const awayTeam = teams.find(t => t.homeAway === 'away').team;

        // Find corresponding player groups
        const homePlayers = players.find(p => p.team.id === homeTeam.id);
        const awayPlayers = players.find(p => p.team.id === awayTeam.id);

        content = `
            <div class="tabs">
                <button class="tab-btn active" data-team="away">${awayTeam.displayName}</button>
                <button class="tab-btn" data-team="home">${homeTeam.displayName}</button>
            </div>
            <div class="team-container">
                <div id="away-team" class="team-boxscore" style="display:block;">
                    ${generateTeamTable(awayPlayers)}
                </div>
                <div id="home-team" class="team-boxscore" style="display:none;">
                    ${generateTeamTable(homePlayers)}
                </div>
            </div>
        `;

        boxscoreContent.innerHTML = content;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const team = this.dataset.team;
                document.querySelectorAll('.team-boxscore').forEach(div => {
                    div.style.display = div.id === `${team}-team` ? 'block' : 'none';
                });
            });
        });
    } 
    catch (error) {
        boxscoreContent.innerHTML = `
            <div class="error">
                Could not load boxscore: ${error.message}
            </div>
        `;
    }
}

function generateTeamTable(playerGroup) {
    if (!playerGroup) return '<div class="error">No player data available</div>';

    const statsData = playerGroup.statistics[0];
    const statNames = statsData.names;
    const athletes = statsData.athletes;

    // Get indexes for all required stats
    const indexes = {
        min: statNames.indexOf('MIN'),
        pts: statNames.indexOf('PTS'),
        fg: statNames.indexOf('FG'),
        threePt: statNames.indexOf('3PT'),
        ft: statNames.indexOf('FT'),
        oreb: statNames.indexOf('OREB'),
        dreb: statNames.indexOf('DREB'),
        reb: statNames.indexOf('REB'),
        ast: statNames.indexOf('AST'),
        stl: statNames.indexOf('STL'),
        blk: statNames.indexOf('BLK'),
        to: statNames.indexOf('TO'),
        pf: statNames.indexOf('PF'),
        plusMinus: statNames.indexOf('+/-')
        
    };

    let tableContent = `
        <div class="boxscore-team">
            <div class="player-row player-header">
                <div>Player</div>
                <div>MIN</div>
                <div>PTS</div>
                <div>FG</div>
                <div>3PT</div>
                <div>FT</div>
                <div>OREB</div>
                <div>DREB</div>
                <div>REB</div>
                <div>AST</div>
                <div>STL</div>
                <div>BLK</div>
                <div>TO</div>
                <div>PF</div>
                <div>+/-</div>   
            </div>
    `;

    athletes.forEach(athlete => {
        const stats = athlete.stats;
        tableContent += `
            <div class="player-row">
                <div>${athlete.athlete.displayName}</div>
                <div>${stats[indexes.min] || '-'}</div>
                <div>${stats[indexes.pts] || '-'}</div>
                <div>${stats[indexes.fg] || '-'}</div>
                <div>${stats[indexes.threePt] || '-'}</div>
                <div>${stats[indexes.ft] || '-'}</div>
                <div>${stats[indexes.oreb] || '-'}</div>
                <div>${stats[indexes.dreb] || '-'}</div>
                <div>${stats[indexes.reb] || '-'}</div>
                <div>${stats[indexes.ast] || '-'}</div>
                <div>${stats[indexes.stl] || '-'}</div>
                <div>${stats[indexes.blk] || '-'}</div>
                <div>${stats[indexes.to] || '-'}</div>
                <div>${stats[indexes.pf] || '-'}</div>
                <div>${stats[indexes.plusMinus] || '-'}</div>
            </div>
        `;
    });

    tableContent += '</div>';
    return tableContent;
}

fetchGames();