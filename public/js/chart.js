fetch("/userChartData")
    .then(response => response.json())
    .then(pieChartData => {
        const ctx = document.getElementById('pieChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: pieChartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    })
    .catch(error => console.error("Error loading chart data:", error));