// Sistema de Aniversários - integração com calendário
// Integra com Firestore via window.db e firebase.auth()

(function(){
    let birthdaysData = [];
    let birthdaysUnsub = null;

    // Initialize birthdays system
    function initBirthdaysSystem() {
        if (!window.db) {
            console.warn('Firestore não disponível para aniversários');
            setTimeout(initBirthdaysSystem, 1000);
            return;
        }
        
        subscribeBirthdays();
    }

    // Subscribe to birthdays collection
    function subscribeBirthdays() {
        if (birthdaysUnsub) birthdaysUnsub();
        
        birthdaysUnsub = window.db.collection('birthdays').onSnapshot(snapshot => {
            birthdaysData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                birthdaysData.push({
                    id: doc.id,
                    name: data.name,
                    date: data.date,
                    month: data.month, // 0-indexed
                    day: data.day,
                    addedBy: data.addedBy,
                    addedByName: data.addedByName,
                    createdAt: data.createdAt
                });
            });
            
            // Update calendar if it's visible
            updateCalendarWithBirthdays();
            
            // Update birthday lists if on birthday page
            if (typeof loadBirthdays === 'function' && document.getElementById('allBirthdays')) {
                loadBirthdays();
            }
            if (typeof loadUpcomingBirthdays === 'function' && document.getElementById('upcomingBirthdays')) {
                loadUpcomingBirthdays();
            }
        }, error => {
            console.error('Erro ao ouvir aniversários:', error);
        });
    }

    // Get birthdays for a specific date
    function getBirthdaysForDate(date) {
        const month = date.getMonth();
        const day = date.getDate();
        
        return birthdaysData.filter(birthday => 
            birthday.month === month && birthday.day === day
        );
    }

    // Get all birthdays for a specific month
    function getBirthdaysForMonth(month) {
        return birthdaysData.filter(birthday => birthday.month === month);
    }

    // Update calendar with birthday indicators
    function updateCalendarWithBirthdays() {
        // Update page calendar if it exists
        const pageCalendar = document.getElementById('pageCalendar');
        if (pageCalendar) {
            updateCalendarDaysWithBirthdays(pageCalendar);
        }
        
        // Update modal calendar if it exists
        const modalCalendar = document.getElementById('calendar');
        if (modalCalendar) {
            updateCalendarDaysWithBirthdays(modalCalendar);
        }
    }

    // Add birthday indicators to calendar days
    function updateCalendarDaysWithBirthdays(calendarElement) {
        const calendarDays = calendarElement.querySelectorAll('.calendar-day');
        
        calendarDays.forEach(dayElement => {
            const dayNumber = parseInt(dayElement.textContent.trim());
            if (isNaN(dayNumber)) return;
            
            // Get current month/year from calendar
            const monthYearElement = calendarElement.querySelector('.calendar-month-year') || 
                                   calendarElement.querySelector('h5') ||
                                   calendarElement.querySelector('h4');
            if (!monthYearElement) return;
            
            const monthYearText = monthYearElement.textContent;
            const [monthName, year] = monthYearText.split(' ');
            
            const months = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            
            const monthIndex = months.indexOf(monthName);
            if (monthIndex === -1) return;
            
            const date = new Date(parseInt(year), monthIndex, dayNumber);
            const dayBirthdays = getBirthdaysForDate(date);
            
            // Remove any existing birthday dots inside task-dots
            const dotsContainer = dayElement.querySelector('.task-dots');
            if (dotsContainer) {
                const existingBirthdayDots = dotsContainer.querySelectorAll('.task-dot.aniversario');
                existingBirthdayDots.forEach(d => d.remove());
            }

            if (dayBirthdays.length > 0) {
                // Add a blue birthday dot into the dots container
                const dot = document.createElement('span');
                dot.className = 'task-dot aniversario';
                dot.title = `Aniversário${dayBirthdays.length > 1 ? 's' : ''}: ${dayBirthdays.map(b => b.name).join(', ')}`;

                if (dotsContainer) {
                    dotsContainer.appendChild(dot);
                } else {
                    // If no dots container exists, create one
                    const container = document.createElement('div');
                    container.className = 'task-dots';
                    container.appendChild(dot);
                    dayElement.appendChild(container);
                }

                dayElement.classList.add('has-birthday');
                dayElement.classList.add('has-task');
            } else {
                dayElement.classList.remove('has-birthday');
            }
        });
    }

    // Get upcoming birthdays (next 30 days)
    function getUpcomingBirthdays(days = 30) {
        const today = new Date();
        const upcoming = [];
        
        birthdaysData.forEach(birthday => {
            const thisYear = new Date(today.getFullYear(), birthday.month, birthday.day);
            const nextYear = new Date(today.getFullYear() + 1, birthday.month, birthday.day);
            
            let birthdayDate = thisYear >= today ? thisYear : nextYear;
            let daysUntil = Math.ceil((birthdayDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntil <= days) {
                upcoming.push({
                    ...birthday,
                    daysUntil,
                    birthdayDate
                });
            }
        });
        
        return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBirthdaysSystem);
    } else {
        initBirthdaysSystem();
    }

    // Initialize when Firebase is ready
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(user => {
            if (user && window.db) {
                initBirthdaysSystem();
            }
        });
    }

    // Make functions globally available
    window.getBirthdaysForDate = getBirthdaysForDate;
    window.getBirthdaysForMonth = getBirthdaysForMonth;
    window.getUpcomingBirthdays = getUpcomingBirthdays;
    window.updateCalendarWithBirthdays = updateCalendarWithBirthdays;
})();
