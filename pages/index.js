{/* NOUVEAU : Suivi Achats/Ventes */}
          <div 
            onClick={() => router.push('/transactions')}
            className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-6 rounded-2xl mb-4 group-hover:scale-110 transition">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Suivi Achats/Ventes</h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Suivez vos bénéfices en temps réel
              </p>
              <div className="flex gap-2 flex-wrap justify-center text-sm">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">💰 Bénéfices</span>
                <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full">📊 Stats</span>
              </div>
            </div>
          </div>

          {/* NOUVEAU : Ludothèque */}
          <div 
            onClick={() => router.push('/ludotheque')}
            className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-6 rounded-2xl mb-4 group-hover:scale-110 transition">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Ma Ludothèque</h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Organisez vos jeux sur des étagères virtuelles
              </p>
              <div className="flex gap-2 flex-wrap justify-center text-sm">
                <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full">🎲 Organisation</span>
                <span className="bg-fuchsia-100 text-fuchsia-700 px-3 py-1 rounded-full">📚 Règles IA</span>
              </div>
            </div>
          </div>
        </div>
