async function getRecommendations() {

    const response = await fetch("/recommendations?mood=Hype&user_id=1");
    const data = await response.json();

    const container = document.getElementById("results");
    container.innerHTML = "";

    data.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-card";

        div.innerHTML = `
            <h3>${item.title}</h3>
            <p>Type: ${item.type}</p>
            <p>Score: ${item.recommendation_score}</p>
        `;

        container.appendChild(div);
    });
}