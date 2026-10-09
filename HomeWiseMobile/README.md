# 📱 Guia de Integração do Aplicativo Mobile (React Native + Firebase)

Este guia e os arquivos desta pasta (`mobile-guide/`) foram criados para a equipe integrar o **Aplicativo Mobile em React Native** com o ecossistema **HomeWise** usando o **Firebase**.

---

## 📁 Estrutura dos Arquivos Prontos

1. [`firebaseConfig.js`](file:///c:/Users/45447259843/Documents/TCC%20-%20HomeWise/HomeWise/mobile-guide/firebaseConfig.js): Conexão direta com o projeto `homewise-65bb1` no Firebase.
2. [`authService.js`](file:///c:/Users/45447259843/Documents/TCC%20-%20HomeWise/HomeWise/mobile-guide/authService.js): Funções de Login, Cadastro, Logout e observador de sessão (Firebase Authentication).
3. [`leiturasService.js`](file:///c:/Users/45447259843/Documents/TCC%20-%20HomeWise/HomeWise/mobile-guide/leiturasService.js): Escuta **em tempo real** a última medição de água e energia do ESP8266 salva no Cloud Firestore.
4. [`LoginScreen.js`](file:///c:/Users/45447259843/Documents/TCC%20-%20HomeWise/HomeWise/mobile-guide/LoginScreen.js): Tela completa de autenticação com visual dark mode do HomeWise.
5. [`DashboardScreen.js`](file:///c:/Users/45447259843/Documents/TCC%20-%20HomeWise/HomeWise/mobile-guide/DashboardScreen.js): Tela principal com cards de consumo de Água (L, L/min) e Energia (kWh, W, V) com badge "AO VIVO".

---

## 🛠️ Como usar no projeto React Native da equipe

### 1. Instalar a dependência do Firebase no app
Para instalar as dependências deste projeto Expo, incluindo as versões compatíveis entre Expo e React Native, execute na pasta `HomeWiseMobile`:
```bash
npm install
```

Se estiver copiando os arquivos para outro projeto que ainda não possui Firebase, execute na pasta desse projeto:
```bash
npm install firebase
```

### 2. Copiar os arquivos
Basta copiar os arquivos desta pasta `mobile-guide/` para dentro da pasta `src/` ou raiz do projeto React Native de vocês.

### 3. Exemplo de uso no `App.js`:
```jsx
import React, { useState, useEffect } from "react";
import { observarAuth } from "./authService";
import LoginScreen from "./LoginScreen";
import DashboardScreen from "./DashboardScreen";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Escuta se o usuario esta autenticado
    const unsubscribe = observarAuth((usuarioLogado) => {
      setUser(usuarioLogado);
    });
    return () => unsubscribe();
  }, []);

  return user ? <DashboardScreen user={user} /> : <LoginScreen />;
}
```

---

## 📡 Como os dados chegam do ESP8266 até o celular

1. **ESP8266 (Sensores YF-S201 e PZEM-004T)**:
   - Faz `HTTP POST` com JSON para o endpoint `/api/dados` da API Node.js.
2. **API Node.js (`api/server.js`)**:
   - Valida os valores numéricos e grava o documento na coleção `leituras` do Firestore com timestamp do servidor.
3. **Aplicativo React Native**:
   - Como o app usa o `onSnapshot()` do `leiturasService.js`, o celular recebe a leitura instantaneamente sem precisar recarregar a tela!
