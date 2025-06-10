function Header() {
    return `
        <header class="bg-orange text-white p-3">
            <div class="container">
                <h1 class="text-center">Organizador de Tarefas</h1>
                <nav class="navbar navbar-expand-lg navbar-light">
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav">
                            <li class="nav-item">
                                <a class="nav-link text-white" href="#home">Início</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link text-white" href="#calendar">Calendário</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link text-white" href="#tasks">Tarefas</a>
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>
        </header>
    `;
}

export default Header;