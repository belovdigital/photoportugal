// Reviews batch 4 — next 60 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "d3d7487f-1c82-488b-8e60-95c82162b44d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei trabalhar com a Maria — entendemo-nos logo nos primeiros minutos! Não houve qualquer desconforto durante a sessão. Estava sempre a sugerir como me devia colocar e para onde olhar, ajudando a esconder pequenos defeitos (o que, para nós, raparigas, é muito importante) 😉 Por isso, se procuras uma fotógrafa fácil e confortável de trabalhar com — recomendo a Maria sem reservas!",
      de: "Es war wunderbar, mit Maria zu arbeiten — schon in den ersten Minuten haben wir uns super verstanden! Während des gesamten Shootings war kein Moment unangenehm. Sie hat ständig vorgeschlagen, wie ich stehen und wohin ich schauen soll, und kleine „Schönheitsfehler\" geschickt kaschiert (was uns Frauen ja sehr wichtig ist) 😉 Wenn ihr also eine Fotografin sucht, mit der die Arbeit leicht und angenehm ist — ich empfehle Maria uneingeschränkt!",
      es: "Me encantó trabajar con Maria — conectamos desde los primeros minutos. No hubo absolutamente ninguna incomodidad durante la sesión. No paraba de sugerir cómo ponerme y hacia dónde mirar, ayudando a disimular pequeños \"defectillos\" (que, para las chicas, importa mucho) 😉 Así que, si buscas una fotógrafa con la que sea fácil y cómodo trabajar — recomiendo a Maria sin reservas.",
      fr: "J'ai adoré travailler avec Maria — on s'est tout de suite bien comprises dès les premières minutes ! Il n'y a pas eu une seule gêne pendant la séance. Elle me suggérait sans cesse comment me placer et où regarder, en aidant à masquer les petits \"défauts\" (ce qui, pour nous les filles, compte beaucoup) 😉 Alors si vous cherchez une photographe avec qui c'est simple et confortable de travailler — je recommande Maria sans aucune réserve !",
    },
  },
  {
    id: "3105c53d-dc0b-4997-9bba-7037b87183ab",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Masha é uma fotógrafa INACREDITAVELMENTE talentosa e uma pessoa incrível. É super atenta, sensível e cuidadosa. Durante a sessão sentes que a conheces de uma vida inteira. Se queres descobrir a tua beleza de uma forma nova, é a ela que tens de ir! Não vou escrever muito mais — junto a foto e podes ver por ti. Esta é a primeira sessão da minha vida em que adoro ABSOLUTAMENTE TODAS as fotos (não há aquele \"oh, aqui saí bem, ali não tanto\") — estou simplesmente apaixonada por cada imagem 😍🥰",
      de: "Masha ist eine UNGLAUBLICH talentierte Fotografin und ein ganz wunderbarer Mensch. Sie ist extrem aufmerksam, einfühlsam und fürsorglich. Während des Shootings fühlt es sich an, als würde man sich schon ein Leben lang kennen. Wenn du deine Schönheit auf eine neue Art entdecken willst, ist sie genau die Richtige! Ich schreibe nicht zu viel — ich hänge einfach das Foto an, und du kannst es selbst sehen. Das ist das erste Shooting meines Lebens, bei dem ich ABSOLUT JEDES Foto liebe (kein einziges „hier bin ich gut getroffen, da nicht so\") — ich bin einfach in jedes einzelne Bild verliebt 😍🥰",
      es: "Masha es una fotógrafa INCREÍBLEMENTE talentosa y una persona maravillosa. Es súper atenta, sensible y cuidadosa. Durante la sesión sientes que la conoces de toda la vida. Si quieres descubrir tu belleza de una forma nueva, ¡a ella es a quien tienes que ir! No voy a escribir demasiado — adjunto la foto y lo veis vosotros. Es la primera sesión en mi vida en la que me encantan ABSOLUTAMENTE TODAS las fotos (no hay ningún \"aquí salí bien, ahí no tanto\") — estoy simplemente enamorada de cada imagen 😍🥰",
      fr: "Masha est une photographe INCROYABLEMENT talentueuse et une personne formidable. Elle est super attentive, sensible et bienveillante. Pendant la séance, tu as l'impression de la connaître depuis toujours. Si tu veux découvrir ta beauté d'une nouvelle façon, c'est elle qu'il faut voir ! Je ne vais pas trop en écrire — je joins la photo et tu peux juger par toi-même. C'est la première séance de ma vie où j'adore ABSOLUMENT CHAQUE photo (pas de \"oh là je suis bien, là moins\") — je suis tout simplement amoureuse de chaque cliché 😍🥰",
    },
  },
  {
    id: "9b02fd02-2590-428b-8c32-62f0060e3b6a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não foi apenas uma sessão fotográfica — foi pura magia! Eu e o meu marido continuamos sob a impressão da sessão com a Maria na costa atlântica em Portugal. A atmosfera, as emoções, a luz, o vento, o oceano e a Maria com o seu talento incrível — tudo se uniu numa imagem perfeita. Cada foto é uma história em si, cheia de sentimentos verdadeiros e de um momento real. A Maria não é só uma fotógrafa, é uma artista que sente as pessoas e sabe captar exatamente os segundos que queremos guardar para sempre. Divertimo-nos imenso com o próprio processo — tudo foi fácil, natural e genuinamente alegre. E o resultado superou todas as nossas expectativas! Esta sessão fica connosco não apenas como fotos, mas como uma memória quente e luminosa para a vida. Sabemos uma coisa: se voltarmos a Portugal, é a Maria e mais ninguém. E queremos mesmo repetir esta experiência incrível. Maria, és super-mega-fixe, talentosa e inspiradora! Obrigada pela magia!",
      de: "Es war nicht einfach ein Fotoshooting — es war echte Magie! Mein Mann und ich stehen immer noch unter dem Eindruck der Session mit Maria an der Atlantikküste in Portugal. Die Atmosphäre, die Emotionen, das Licht, der Wind, der Ozean und Maria mit ihrem unglaublichen Talent — alles fügte sich zu einem perfekten Bild. Jede Aufnahme ist eine eigene Geschichte, gefüllt mit echten Gefühlen und einem echten Moment. Maria ist nicht nur Fotografin, sie ist eine Künstlerin, die Menschen spürt und genau die Sekunden einzufangen weiß, die du für immer behalten möchtest. Wir hatten unglaublich viel Spaß am Prozess selbst — alles war leicht, natürlich und ehrlich freudvoll. Und das Ergebnis hat all unsere Erwartungen übertroffen! Diese Session bleibt uns nicht nur als Fotos in Erinnerung, sondern als warme, helle Erinnerung fürs Leben. Eines wissen wir sicher: Wenn wir je wieder in Portugal sind, dann nur mit Maria. Und wir möchten dieses unglaubliche Erlebnis unbedingt wiederholen. Maria, du bist super-mega-cool, talentiert und inspirierend! Danke für die Magie!",
      es: "No fue solo una sesión de fotos — ¡fue auténtica magia! Mi marido y yo seguimos bajo la impresión de la sesión con Maria en la costa atlántica de Portugal. La atmósfera, las emociones, la luz, el viento, el océano y Maria con su increíble talento — todo se unió en una imagen perfecta. Cada toma es una historia en sí misma, llena de sentimientos genuinos y de un momento real. Maria no es solo fotógrafa, es una artista que siente a las personas y sabe captar exactamente los segundos que quieres conservar para siempre. Disfrutamos muchísimo del proceso — todo fue fácil, natural y verdaderamente alegre. ¡Y el resultado superó todas nuestras expectativas! Esta sesión se queda con nosotros no solo como fotos, sino como un recuerdo cálido y luminoso para toda la vida. Sabemos una cosa: si volvemos a Portugal, será con Maria y solo con Maria. Y de verdad queremos repetir esta experiencia increíble. ¡Maria, eres súper-mega-genial, talentosa e inspiradora! ¡Gracias por la magia!",
      fr: "Ce n'était pas juste une séance photo — c'était une vraie magie ! Mon mari et moi sommes encore sous le charme de la séance avec Maria sur la côte atlantique au Portugal. L'atmosphère, les émotions, la lumière, le vent, l'océan, et Maria avec son talent incroyable — tout s'est assemblé en une image parfaite. Chaque cliché est une histoire en soi, rempli de sentiments authentiques et d'un vrai moment. Maria n'est pas qu'une photographe, c'est une artiste qui ressent les gens et sait capturer exactement les secondes que l'on veut garder à jamais. Nous nous sommes énormément amusés pendant le processus — tout a été simple, naturel et sincèrement joyeux. Et le résultat a dépassé toutes nos attentes ! Cette séance reste avec nous non seulement comme des photos, mais comme un souvenir chaleureux et lumineux pour la vie. Une chose est sûre : si nous revenons un jour au Portugal, ce sera avec Maria et seulement Maria. Et nous voulons vraiment refaire cette expérience incroyable. Maria, tu es super-méga-cool, talentueuse et inspirante ! Merci pour la magie !",
    },
  },
  {
    id: "41399b67-1d9c-45a0-89e1-d8194ac47a50",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Quero deixar um enorme agradecimento à Maria por uma sessão fotográfica incrível! Desde os primeiros minutos percebi que estava a lidar com uma verdadeira profissional, que sente o cliente em profundidade e sabe criar uma atmosfera de confiança e conforto. O que mais me agradou foi a abordagem personalizada: a Maria esclareceu todos os meus desejos previamente, sugeriu ideias e locais adequados e ajudou com o look e o mood. As fotos ficaram vivas, profundas e realmente \"minhas\". Sente-se que a Maria coloca alma no que faz e que ama genuinamente o seu trabalho. Recomendo a Maria com toda a confiança a quem procura, mais do que belas fotos, uma verdadeira colaboração criativa e um resultado que vai querer ver vezes sem conta.",
      de: "Ich möchte mich bei Maria von ganzem Herzen für ein unglaubliches Fotoshooting bedanken! Schon nach den ersten Minuten war klar, dass ich es mit einer echten Profi zu tun hatte, die ihre Kund:innen feinfühlig wahrnimmt und eine vertrauensvolle, angenehme Atmosphäre schafft. Was mich besonders begeistert hat, war ihr persönlicher Ansatz: Maria hat alle meine Wünsche im Voraus geklärt, passende Ideen und Locations vorgeschlagen und beim Look und der Stimmung beraten. Die Fotos sind lebendig, tiefgründig und wirklich „meine\" geworden. Man spürt, dass Maria mit Seele bei der Sache ist und ihre Arbeit von Herzen liebt. Ich empfehle Maria absolut allen, die nicht nur schöne Bilder suchen, sondern eine echte kreative Zusammenarbeit und ein Ergebnis, das man immer wieder ansehen will.",
      es: "Quiero expresar un enorme agradecimiento a Maria por una sesión fotográfica increíble. Desde los primeros minutos tuve claro que estaba ante una verdadera profesional, que siente al cliente con mucha profundidad y sabe crear una atmósfera de confianza y comodidad. Lo que más me encantó fue su enfoque personalizado: Maria aclaró previamente todos mis deseos, sugirió ideas y localizaciones adecuadas y me ayudó con el look y el mood. Las fotos quedaron vivas, profundas y realmente \"mías\". Se nota que Maria pone alma en lo que hace y que ama genuinamente su trabajo. Recomiendo a Maria con total confianza a quien busque, más que fotos bonitas, una auténtica colaboración creativa y un resultado al que vas a querer volver una y otra vez.",
      fr: "Je veux exprimer un immense merci à Maria pour une séance photo incroyable ! Dès les premières minutes, j'ai compris que j'avais affaire à une vraie professionnelle, qui ressent profondément le client et sait créer une atmosphère de confiance et de confort. Ce qui m'a particulièrement enchantée, c'est son approche personnalisée : Maria a clarifié tous mes souhaits en amont, a proposé des idées et des lieux adaptés et m'a aidée pour le look et l'ambiance. Les photos sont vivantes, profondes et vraiment \"miennes\". On sent que Maria met de l'âme dans ce qu'elle fait et qu'elle aime sincèrement son travail. Je recommande Maria en toute confiance à toute personne qui cherche, au-delà de belles photos, une vraie collaboration créative et un résultat qu'on a envie de revoir encore et encore.",
    },
  },
  {
    id: "39a2ed24-b0e9-440c-8b39-abafd0227c98",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Se procuras uma fotógrafa que te faça sentir vivo até num cenário de lápides, a Maria é mesmo essa pessoa. A nossa sessão decorreu num cemitério, entre caveiras, corações mortos (talvez antigos) e estilo eterno. A atmosfera era ideal: um ligeiro cheiro a decomposição, corvos ao fundo, eu como diva gótica e a Maria como necromante com câmara. Ela apanha a luz como se o próprio sol tivesse aceitado fazer parte do espetáculo. E, acima de tudo, sabe trabalhar com o cliente, mesmo quando este está ligeiramente possuído por rituais. As fotos ficaram tão vivas que alguns dos esqueletos tiveram inveja. Obrigada, Maria, por me ajudares a parecer uma deusa da morte e não apenas uma mulher cansada com olheiras. Volto — se não neste século, no próximo.",
      de: "Wenn du eine Fotografin suchst, die dich selbst vor Grabsteinen lebendig aussehen lässt, ist Maria genau die Richtige. Unser Shooting fand auf einem Friedhof statt — zwischen Schädeln, toten Herzen (vermutlich ehemaligen) und ewigem Stil. Die Atmosphäre war ideal: ein leichter Geruch von Verfall, Krähen im Hintergrund, ich als gotische Diva und Maria als Nekromantin mit Kamera. Sie fängt das Licht ein, als hätte die Sonne selbst zugestimmt, Teil der Performance zu sein. Und vor allem: Sie weiß, wie man mit Kund:innen umgeht — selbst wenn diese leicht ritual-besessen sind. Die Fotos sind so lebendig geworden, dass einige Skelette neidisch wurden. Danke, Maria, dass du mich wie eine Göttin des Todes hast aussehen lassen und nicht wie eine müde Frau mit Augenringen. Ich komme wieder — wenn nicht in diesem Jahrhundert, dann eben im nächsten.",
      es: "Si buscas una fotógrafa que te haga sentir vivo incluso entre lápidas, Maria es exactamente esa persona. Nuestra sesión tuvo lugar en un cementerio, entre calaveras, corazones muertos (posiblemente antiguos) y estilo eterno. La atmósfera era ideal: un ligero olor a descomposición, cuervos de fondo, yo como diva gótica y Maria como nigromante con cámara. Atrapa la luz como si el sol mismo hubiera aceptado formar parte del espectáculo. Y, sobre todo, sabe trabajar con el cliente, incluso cuando el cliente está ligeramente poseído por rituales. Las fotos quedaron tan vivas que algunos esqueletos sintieron envidia. Gracias, Maria, por ayudarme a parecer una diosa de la muerte y no solo una mujer cansada con ojeras. Volveré — si no en este siglo, en el siguiente.",
      fr: "Si vous cherchez une photographe capable de vous faire paraître vivant·e même devant des pierres tombales, Maria est exactement cette personne. Notre séance s'est déroulée dans un cimetière, entre crânes, cœurs morts (peut-être anciens) et style éternel. L'ambiance était idéale : une légère odeur de décomposition, des corbeaux en fond, moi en diva gothique et Maria en nécromancienne avec un appareil photo. Elle attrape la lumière comme si le soleil lui-même avait accepté de faire partie du spectacle. Et surtout, elle sait travailler avec le client, même quand celui-ci est légèrement possédé par les rituels. Les photos sont si vivantes que quelques squelettes ont été jaloux. Merci, Maria, de m'avoir aidée à ressembler à une déesse de la mort et pas juste à une femme fatiguée avec des cernes. Je reviendrai — sinon dans ce siècle, alors dans le suivant.",
    },
  },
  {
    id: "07984848-2fcb-405c-88ff-35c41b241a21",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui fotografou os batizados dos meus dois filhos e não podia estar mais feliz. Discreto, capta todos os momentos essenciais, sempre com simpatia, gentileza, paciência e boa atitude. Preços acessíveis e entrega rápida do trabalho. Também fazemos com ele todos os anos sessões fotográficas de Natal em família e os resultados não podiam ser melhores, criando recordações encantadoras para sempre! 😊 Recomendo vivamente, 5 estrelas!",
      de: "Rui hat die Taufen meiner beiden Kinder fotografiert, und ich könnte nicht glücklicher sein. Dezent fängt er alle wesentlichen Momente ein, immer mit Freundlichkeit, Herzlichkeit, Geduld und guter Laune. Erschwingliche Preise und schnelle Lieferung der Arbeit. Wir machen auch jedes Jahr Familien-Weihnachts-Shootings mit ihm, und die Ergebnisse könnten nicht schöner sein — bezaubernde Erinnerungen für die Ewigkeit! 😊 Ich empfehle ihn wärmstens, 5 Sterne!",
      es: "Rui fotografió los bautizos de mis dos hijos y no podría estar más feliz. Discreto, capta todos los momentos esenciales, siempre con simpatía, amabilidad, paciencia y buena actitud. Precios asequibles y entrega rápida del trabajo. Además, todos los años hacemos con él sesiones de Navidad en familia y los resultados no podrían ser mejores, ¡creando recuerdos preciosos para siempre! 😊 ¡Lo recomiendo muchísimo, 5 estrellas!",
      fr: "Rui a photographié les baptêmes de mes deux enfants et je ne pourrais pas être plus heureuse. Discret, il capture tous les moments essentiels, toujours avec gentillesse, douceur, patience et une belle attitude. Des prix abordables et une livraison rapide du travail. Nous faisons aussi avec lui chaque année des séances de Noël en famille et les résultats ne pourraient pas être meilleurs, créant pour toujours de magnifiques souvenirs ! 😊 Je recommande vivement, 5 étoiles !",
    },
  },
  {
    id: "2762f9b0-59ea-4a14-8d39-88ca9b2a8cdd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui assegurou a cobertura fotográfica de dois eventos corporativos na empresa onde trabalhei e só tenho coisas boas a dizer.\nDa simpatia e disponibilidade ao resultado final rápido e fantástico das imagens captadas, recomendo vivamente o seu trabalho.\nQue continue assim!",
      de: "Rui hat die fotografische Begleitung von zwei Firmenevents in meinem damaligen Unternehmen übernommen, und ich kann nur Gutes sagen.\nVon der Freundlichkeit und Verfügbarkeit bis zum schnellen und fantastischen Endergebnis der Bilder — ich kann seine Arbeit wärmstens empfehlen.\nMach weiter so!",
      es: "Rui se encargó de la cobertura fotográfica de dos eventos corporativos en la empresa donde trabajaba y solo tengo cosas buenas que decir.\nDesde su simpatía y disponibilidad hasta el rápido y fantástico resultado final de las imágenes captadas, recomiendo muchísimo su trabajo.\n¡Que siga así!",
      fr: "Rui a assuré la couverture photo de deux événements d'entreprise dans la société où je travaillais, et je n'ai que des choses positives à dire.\nDe sa gentillesse et sa disponibilité au résultat final rapide et fantastique des images captées, je recommande vivement son travail.\nQu'il continue ainsi !",
    },
  },
  {
    id: "d18676ac-8d7d-4977-b0cd-0094ab38de93",
    title: {
      pt: "A melhor fotógrafa do mundo",
      de: "Die beste Fotografin der Welt",
      es: "La mejor fotógrafa del mundo",
      fr: "La meilleure photographe du monde",
    },
    text: {
      pt: "A nossa Jenni — a escolha mais fácil deste casamento. Acabámos de receber as fotos e não temos palavras para agradecer à Jenni pelo seu trabalho. Conseguiu captar cada momento importante — tem um talento enorme, um coração puro e uma alma linda. Chorámos de emoção ao ver as fotos — foi como reviver aquele dia outra vez. A Jennifer é a melhor fotógrafa que já conhecemos. As fotos dela são mágicas — é mesmo a melhor do mundo. O talento dela vai além deste mundo. Obrigada por existires, querida Jenni — sem o teu talento não teria sido a mesma coisa. ❤️",
      de: "Unsere Jenni — die einfachste Entscheidung dieser Hochzeit. Wir haben gerade unsere Fotos bekommen und finden keine Worte, um Jenni für ihre Arbeit zu danken. Sie hat es geschafft, jeden wichtigen Moment einzufangen — sie hat ein riesiges Talent, ein reines Herz und eine wunderschöne Seele. Wir haben beim Anschauen der Fotos geweint — es war, als würden wir diesen Tag noch einmal erleben. Jennifer ist die beste Fotografin, die wir je kennengelernt haben. Ihre Fotos sind magisch — sie ist wirklich die Beste der Welt. Ihr Talent geht über diese Welt hinaus. Danke, dass es dich gibt, liebe Jenni — ohne dein Talent wäre es nicht dasselbe gewesen. ❤️",
      es: "Nuestra Jenni — la elección más fácil de toda la boda. Acabamos de recibir nuestras fotos y no tenemos palabras para agradecerle a Jenni su trabajo. Consiguió captar cada momento importante — tiene un talento enorme, un corazón puro y un alma preciosa. Lloramos de emoción al ver nuestras fotos — fue como volver a vivir ese día. Jennifer es la mejor fotógrafa que hemos conocido. Sus fotos son mágicas; de verdad es la mejor del mundo. Su talento va más allá de este mundo. Gracias por existir, querida Jenni — sin tu talento no habría sido lo mismo. ❤️",
      fr: "Notre Jenni — le choix le plus évident de tout ce mariage. Nous venons de recevoir nos photos et nous n'avons pas de mots pour la remercier de son travail. Elle a su capturer chaque moment important — elle a un immense talent, un cœur pur et une âme magnifique. Nous avons pleuré d'émotion en voyant nos photos — c'était comme revivre cette journée. Jennifer est la meilleure photographe que nous ayons jamais rencontrée. Ses photos sont magiques, elle est vraiment la meilleure au monde. Son talent va au-delà de ce monde. Merci d'exister, chère Jenni — sans ton talent, cela n'aurait pas été pareil. ❤️",
    },
  },
  {
    id: "3e0c0b2d-879e-4f5a-9825-53a12b00e1fa",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não consigo pôr em palavras o quanto adorei o trabalho da Mónica. Simples, dedicada, com um enorme cuidado por nós, mostrando a sua disponibilidade, simpatia e dedicação a cada detalhe. Que trabalho magnífico! 🥰 Adorámos e de certeza voltaremos a contactá-la um dia. 🥰♥️ Muito obrigada — não consigo mesmo descrever como ficaram maravilhosas as fotos. 🙏🏻♥️",
      de: "Ich kann nicht in Worte fassen, wie sehr ich Mónicas Arbeit geliebt habe. Schlicht, hingebungsvoll, mit so viel Fürsorge für uns — sie hat ihre Verfügbarkeit, Freundlichkeit und ihr Engagement in jedem Detail gezeigt. Was für eine großartige Arbeit! 🥰 Wir haben es geliebt und werden uns ganz sicher eines Tages wieder bei ihr melden. 🥰♥️ Vielen, vielen Dank — ich kann gar nicht beschreiben, wie wundervoll die Fotos geworden sind. 🙏🏻♥️",
      es: "No puedo poner en palabras cuánto me ha encantado el trabajo de Mónica. Sencilla, dedicada, con un enorme cuidado por nosotros, mostrando disponibilidad, simpatía y dedicación a cada detalle. ¡Qué trabajo tan magnífico! 🥰 Nos encantó, y seguro que volveremos a contactarla algún día. 🥰♥️ Mil gracias — de verdad no puedo describir lo maravillosas que quedaron las fotos. 🙏🏻♥️",
      fr: "Je n'arrive pas à mettre en mots à quel point j'ai adoré le travail de Mónica. Simple, dévouée, avec une énorme attention pour nous, montrant sa disponibilité, sa gentillesse et son dévouement dans chaque détail. Quel travail magnifique ! 🥰 Nous avons adoré, et nous reprendrons certainement contact avec elle un jour. 🥰♥️ Merci beaucoup — je n'arrive vraiment pas à décrire à quel point les photos sont magnifiques. 🙏🏻♥️",
    },
  },
  {
    id: "e9a34323-e31e-4455-90ec-f7805a4dcf35",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Estar à frente da câmara da Sophie foi muito natural e seguro. Fez-me sentir muito confiante e as fotos estão absolutamente incríveis! Recomendo totalmente!\n❤️1\nSophie Bellmann — Fotógrafa em Lisboa e Costa da Caparica",
      de: "Vor Sophies Kamera zu stehen, hat sich sehr natürlich und sicher angefühlt. Sie hat mir richtig viel Selbstvertrauen gegeben, und die Bilder sind absolut umwerfend! Ich kann sie uneingeschränkt empfehlen!\n❤️1\nSophie Bellmann — Fotografin in Lissabon & Costa da Caparica",
      es: "Estar delante de la cámara de Sophie se sintió muy natural y seguro. Me hizo sentir con mucha confianza y las fotos son absolutamente increíbles. ¡Totalmente recomendable!\n❤️1\nSophie Bellmann — Fotógrafa en Lisboa y Costa da Caparica",
      fr: "Être devant l'objectif de Sophie a été très naturel et rassurant. Elle m'a donné beaucoup de confiance et les photos sont absolument incroyables ! Je la recommande totalement !\n❤️1\nSophie Bellmann — Photographe à Lisbonne et Costa da Caparica",
    },
  },
  {
    id: "1c56ba97-b2fe-4f4b-98db-9ed36b7875f9",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie é uma grande criativa. O processo de trabalho com ela tem sido muito fluido e objetivo. A comunicação tem sido ótima e agradeço imenso o tempo extra que dedica à produção do conteúdo para garantir que tudo é entregue exatamente como a marca quer.\nVou continuar a trabalhar com ela no futuro, sem dúvida!",
      de: "Sophie ist eine großartige Kreative. Die Zusammenarbeit mit ihr verläuft sehr unkompliziert und auf den Punkt. Die Kommunikation ist hervorragend, und ich schätze es sehr, dass sie sich extra Zeit für die Produktion der Inhalte nimmt, um sicherzustellen, dass alles genau so geliefert wird, wie es die Marke wünscht.\nIch werde definitiv weiter mit ihr arbeiten!",
      es: "Sophie es una gran creativa. El proceso de trabajo con ella es muy fluido y conciso. La comunicación es genial y agradezco muchísimo el tiempo extra que dedica a la producción del contenido para asegurarse de que todo lo entregado es justo lo que la marca quiere.\nSeguro que seguiré trabajando con ella en el futuro!",
      fr: "Sophie est une grande créative. Le processus de travail avec elle est très fluide et précis. La communication est excellente et j'apprécie vraiment le temps supplémentaire qu'elle consacre à la production du contenu pour s'assurer que tout ce qui est livré correspond exactement à ce que la marque souhaite.\nJe continuerai à travailler avec elle à l'avenir, sans aucun doute !",
    },
  },
  {
    id: "f00920a7-555e-4777-81cd-5684972ba95c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie é, verdadeiramente, uma fotógrafa com um dom! Desde o momento em que estamos à frente da câmara, ela tem uma forma incrível de nos fazer sentir completamente à vontade e bonitas. A sua energia calorosa e o seu talento natural criam um espaço onde o nosso eu autêntico brilha. Capta mais do que apenas uma imagem — capta a alma. Recomendo vivamente 😊",
      de: "Sophie ist wirklich eine begnadete Fotografin! Sobald man vor ihrer Kamera steht, hat sie eine unglaubliche Art, einen vollkommen entspannt und schön fühlen zu lassen. Ihre warme Energie und ihr natürliches Talent schaffen einen Raum, in dem das Authentische in einem leuchten darf. Sie fängt mehr als nur ein Bild ein — sie fängt deine Seele ein. Sehr zu empfehlen 😊",
      es: "Sophie es, de verdad, una fotógrafa con un don! Desde el momento en que te pones delante de su cámara, tiene una forma increíble de hacerte sentir completamente cómoda y guapa. Su energía cálida y su talento natural crean un espacio donde brilla tu yo más auténtico. Capta mucho más que una imagen — capta tu alma. ¡Muy recomendable! 😊",
      fr: "Sophie est, vraiment, une photographe douée d'un don ! Dès l'instant où l'on se retrouve devant son objectif, elle a une façon incroyable de vous mettre complètement à l'aise et de vous faire vous sentir belle. Son énergie chaleureuse et son talent naturel créent un espace où votre vrai vous peut briller. Elle capture bien plus qu'une image — elle capture votre âme. Vivement recommandée 😊",
    },
  },
  {
    id: "3a9f817c-8062-44e6-a55f-e23ed2433550",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Só posso recomendar a Isa. Tivemos uma sessão de família maravilhosa. As fotos estão ótimas e, acima de tudo, divertimo-nos imenso (o que pode ser difícil com crianças pequenas :p). A Isa é incrivelmente profissional, tem muitas ideias para captar momentos inesquecíveis e é super divertido trabalhar com ela. Sentimo-nos à vontade desde o início e divertimo-nos muito. Outro grande ponto é que é local e conhece a zona muito bem. Além disso, assim apoiamos o trabalho local!! Por fim, os pacotes e preços, e o resultado que recebemos, valeram cada cêntimo! Só posso recomendá-la e vou de certeza voltar a marcar com ela. Obrigada, Isa!",
      de: "Ich kann Isa nur empfehlen. Wir hatten ein wunderschönes Familienshooting. Die Fotos sind großartig, und vor allem hatten wir riesigen Spaß (was mit kleinen Kindern nicht immer einfach ist :p). Isa ist unglaublich professionell, hat viele Ideen, um unvergessliche Momente einzufangen, und es macht so viel Spaß, mit ihr zu arbeiten. Wir haben uns sofort wohl und entspannt gefühlt und hatten richtig viel Freude. Ein großer Pluspunkt ist außerdem, dass sie aus der Gegend kommt und sich bestens auskennt. Und so unterstützt man auch lokale Arbeit!! Nicht zu vergessen: Ihre Pakete und Preise sowie das, was wir bekommen haben, sind absolut jeden Cent wert! Ich kann sie nur empfehlen und werde sie ganz sicher wieder buchen. Obrigada, Isa!",
      es: "Solo puedo recomendar a Isa. Tuvimos una preciosa sesión familiar. Las fotos son geniales y, sobre todo, nos lo pasamos genial (lo cual puede ser complicado con niños pequeños :p). Isa es increíblemente profesional, tiene muchísimas ideas para captar momentos inolvidables y es divertidísimo trabajar con ella. Nos sentimos cómodos enseguida y nos divertimos mucho. Otro gran punto es que es local y conoce muy bien la zona. ¡Además, así apoyas el trabajo local! Y para terminar, sus paquetes y precios, y el resultado que recibimos, valen cada céntimo. Solo puedo recomendarla y, sin duda, volveré a reservar con ella. ¡Obrigada, Isa!",
      fr: "Je ne peux que recommander Isa. Nous avons eu une magnifique séance famille. Les photos sont superbes et, surtout, nous nous sommes beaucoup amusés (ce qui peut être délicat avec de jeunes enfants :p). Isa est incroyablement professionnelle, regorge d'idées pour capturer des moments inoubliables, et c'est un vrai plaisir de travailler avec elle. Nous nous sommes immédiatement sentis à l'aise et nous nous sommes vraiment amusés. Autre grand atout : elle est de la région et la connaît parfaitement. En plus, c'est ainsi qu'on soutient le travail local !! Enfin, ses forfaits, ses prix et le rendu obtenu valent absolument chaque centime ! Je ne peux que la recommander et je la rebookerai sans aucun doute. Obrigada, Isa !",
    },
  },
  {
    id: "16537e7d-d6c5-4c9c-a02f-9e6bf7d7b4fd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratámos o Ricardo para fotografar o batizado do meu filho e o serviço foi excelente. Boa comunicação do início ao fim, entrega rápida das fotos e do álbum e, mais importante, o trabalho foi de elevada qualidade. Recomendo!",
      de: "Wir haben Ricardo für die Taufe meines Sohnes engagiert, und der Service war hervorragend. Gute Kommunikation von Anfang bis Ende, schnelle Lieferung der Fotos und des Albums und, am wichtigsten: Die Arbeit war hochqualitativ. Sehr zu empfehlen!",
      es: "Contratamos a Ricardo para fotografiar el bautizo de mi hijo y el servicio fue excelente. Buena comunicación de principio a fin, entrega rápida de las fotos y del álbum y, lo más importante, un trabajo de gran calidad. ¡Lo recomiendo!",
      fr: "Nous avons engagé Ricardo pour photographier le baptême de mon fils et la prestation a été excellente. Bonne communication du début à la fin, livraison rapide des photos et de l'album, et surtout un travail de grande qualité. Je le recommande !",
    },
  },
  {
    id: "79d93958-a79c-4907-8945-2dc64a7064c2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Conheço este fotógrafo há muitos anos e sigo sempre o seu trabalho. Cheguei a participar num projeto seu sobre cancro da mama intitulado \"Perspetivas do Olhar\". As suas fotografias são excelentes e estão sempre ligadas à humanidade, ao património, à saúde, à natureza, ao bem-estar e à autoestima. Capta emoções, alegria e tudo o que é bom — em casamentos, recém-nascidos, sessões de maternidade, sessões de família ou crianças. O seu trabalho cumpre verdadeiramente o lema \"Uma fotografia vale mais do que mil palavras\". Um fotógrafo digno de ser recomendado a quem precise dos seus serviços.",
      de: "Ich kenne diesen Fotografen seit vielen Jahren und verfolge seine Arbeit immer mit Interesse. Ich war sogar Teil eines seiner Projekte zum Thema Brustkrebs mit dem Titel „Perspektiven des Blicks\". Seine Fotos sind ausgezeichnet und stets mit Menschlichkeit, Kulturerbe, Gesundheit, Natur, Wohlbefinden und Selbstwertgefühl verbunden. Er fängt Emotionen, Freude und all das Gute ein — bei Hochzeiten, Neugeborenen, Schwangerschafts-, Familien- oder Kindershootings. Seine Arbeit wird dem Motto „Ein Bild sagt mehr als tausend Worte\" wirklich gerecht. Ein Fotograf, den ich jedem empfehlen würde, der seine Dienste benötigt.",
      es: "Conozco a este fotógrafo desde hace muchos años y siempre sigo su trabajo. Incluso participé en un proyecto suyo sobre el cáncer de mama titulado \"Perspectivas de la Mirada\". Sus fotografías son excelentes y siempre están conectadas con la humanidad, el patrimonio, la salud, la naturaleza, el bienestar y la autoestima. Capta emociones, alegría y todo lo bueno — en bodas, recién nacidos, sesiones de maternidad, sesiones familiares o de niños. Su trabajo cumple de verdad con el lema \"Una fotografía vale más que mil palabras\". Un fotógrafo digno de ser recomendado a cualquiera que necesite sus servicios.",
      fr: "Je connais ce photographe depuis de nombreuses années et je suis toujours son travail. J'ai même participé à l'un de ses projets sur le cancer du sein intitulé \"Perspectives du Regard\". Ses photographies sont excellentes et toujours liées à l'humanité, au patrimoine, à la santé, à la nature, au bien-être et à l'estime de soi. Il capture des émotions, de la joie et tout ce qu'il y a de bon — lors de mariages, de séances pour nouveau-nés, de grossesse, de famille ou pour les enfants. Son travail rend vraiment hommage à la devise \"Une photo vaut mille mots\". Un photographe que je recommande à toute personne ayant besoin de ses services.",
    },
  },
  {
    id: "a732b4f5-4762-4131-b283-9ad2805990bd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Olá, foi a primeira vez que fiz uma sessão fotográfica e senti-me muito à vontade. O Sr. José foi sempre muito profissional — adorei, vale mesmo a pena. De certeza que volto para outra sessão.",
      de: "Hallo, das war meine erste Fotosession, und ich habe mich sehr wohlgefühlt. Herr José war immer ausgesprochen professionell — ich war begeistert, es lohnt sich wirklich. Ich komme ganz sicher für eine weitere Session zurück.",
      es: "Hola, fue la primera vez que hacía una sesión de fotos y me sentí muy cómoda. El Sr. José fue siempre muy profesional — me encantó, de verdad merece la pena. Seguro que vuelvo para otra sesión.",
      fr: "Bonjour, c'était la première fois que je faisais une séance photo et je me suis sentie très à l'aise. M. José a toujours été très professionnel — j'ai adoré, ça vaut vraiment le coup. Je reviendrai certainement pour une autre séance.",
    },
  },
  {
    id: "8c55eda0-5c33-4737-9d62-b54fc3e4b4a2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Grande Rui!! Agora, 1 mês depois deste grande dia, cada vez tenho mais a certeza de que foste das melhores escolhas que fizemos! Da atenção a cada pormenor, do carinho com que sempre nos trataste, da paciência infinita para o nosso pequeno rebento e, entre muitas outras coisas, da arte de captar cada emoção e transformá-la numa recordação eterna! Eternamente gratos seremos nós por tudo aquilo que foste no nosso grande dia e pelos grandes profissionais que trouxeste contigo! Com certeza o fotógrafo da família Leonardo! Muito muito obrigada, Rui!! 🫶🏽",
      de: "Großer Rui!! Jetzt, einen Monat nach diesem großen Tag, bin ich mir immer sicherer: Du warst eine unserer besten Entscheidungen! Die Liebe zum Detail, die Zärtlichkeit, mit der du uns immer behandelt hast, die unendliche Geduld mit unserem kleinen Spross und, neben vielem anderen, die Kunst, jede Emotion einzufangen und in eine ewige Erinnerung zu verwandeln! Wir werden ewig dankbar sein für alles, was du an unserem großen Tag warst, und für die großartigen Profis, die du mitgebracht hast! Du bist auf jeden Fall der Fotograf der Familie Leonardo! Vielen, vielen Dank, Rui!! 🫶🏽",
      es: "¡¡Grande Rui!! Ahora, un mes después de este gran día, cada vez tengo más claro que fuiste una de las mejores elecciones que hicimos! De la atención a cada detalle, del cariño con el que siempre nos trataste, de la paciencia infinita con nuestro pequeñín y, entre otras muchas cosas, del arte de captar cada emoción y convertirla en un recuerdo eterno! Eternamente agradecidos por todo lo que fuiste en nuestro gran día y por los grandes profesionales que trajiste contigo! ¡Sin duda el fotógrafo de la familia Leonardo! ¡¡Muchísimas gracias, Rui!! 🫶🏽",
      fr: "Grand Rui !! Aujourd'hui, un mois après ce grand jour, j'en suis de plus en plus sûre : tu as été l'un de nos meilleurs choix ! De l'attention portée à chaque détail, de la tendresse avec laquelle tu nous as toujours traités, de la patience infinie avec notre petit, et, parmi tant d'autres choses, de l'art de capturer chaque émotion pour la transformer en un souvenir éternel ! Nous te serons éternellement reconnaissants pour tout ce que tu as été dans notre grand jour et pour les superbes professionnels que tu as amenés avec toi ! Tu es sans aucun doute le photographe de la famille Leonardo ! Merci infiniment, Rui !! 🫶🏽",
    },
  },
  {
    id: "163876d0-1a2e-41b6-a77b-15b400f38cc6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adoramos trabalhar com o Rui! Comunicação incrível, super flexível e as fotografias ficam maravilhosas! Para além de simpático, disponibilizou as fotografias em tempo recorde :D Sempre atento ao detalhe e com sugestões que tornam as fotografias únicas! Recomendo imenso!",
      de: "Wir lieben es, mit Rui zu arbeiten! Unglaubliche Kommunikation, super flexibel und die Fotos werden einfach traumhaft! Er ist nicht nur sympathisch — er hat die Fotos auch in Rekordzeit geliefert :D Stets mit Liebe zum Detail und mit Vorschlägen, die jede Aufnahme einzigartig machen! Sehr zu empfehlen!",
      es: "¡Nos encanta trabajar con Rui! Comunicación increíble, súper flexible y las fotos quedan maravillosas. Además de simpático, entregó las fotos en tiempo récord :D Siempre atento al detalle y con sugerencias que hacen que las fotos sean únicas. ¡Lo recomiendo muchísimo!",
      fr: "Nous adorons travailler avec Rui ! Une communication incroyable, super flexible et les photos sont magnifiques ! En plus d'être sympa, il a livré les photos en un temps record :D Toujours attentif aux détails et avec des suggestions qui rendent les photos uniques ! Je recommande vivement !",
    },
  },
  {
    id: "e005afb7-8954-4a84-8c28-23fe622b673b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma ótima experiência com a Patricia! Estávamos a visitar Lisboa vindos do Canadá e o processo de marcação foi super fácil. A Patricia respondeu rapidamente e conseguimos encontrar uma data, hora e local que se ajustaram bem às nossas férias. No dia da experiência, a Patricia fez um excelente trabalho a deixar-nos à vontade e adaptou tudo às nossas preferências. Veio preparada com algumas perguntas ótimas, que nos ajudaram a conectar-nos, e conseguiu captar momentos genuínos. Foi também ótimo poder passar algum tempo a conversar com ela e com o Fernando. As fotos ficaram incríveis. Não podíamos ter pedido melhor experiência.",
      de: "Wir hatten eine großartige Erfahrung mit Patricia! Wir waren aus Kanada zu Besuch in Lissabon, und der Buchungsprozess war super einfach. Patricia hat schnell reagiert, und wir konnten einen Termin, eine Uhrzeit und einen Ort finden, die sich gut in unseren Urlaub einfügten. Am Tag des Shootings hat Patricia hervorragende Arbeit geleistet, uns zu entspannen, und alles an unsere Wünsche angepasst. Sie kam mit ein paar tollen Fragen vorbereitet, die uns geholfen haben, uns zu verbinden, und konnte so echte Momente einfangen. Es war auch wunderschön, etwas Zeit mit ihr und Fernando zu verbringen und zu plaudern. Die Fotos sind unglaublich geworden. Wir hätten uns keine bessere Erfahrung wünschen können.",
      es: "Tuvimos una experiencia genial con Patricia. Estábamos visitando Lisboa desde Canadá y el proceso de reserva fue muy fácil. Patricia respondió rapidísimo y conseguimos encontrar una fecha, hora y lugar que encajaban con nuestras vacaciones. El día de la experiencia, Patricia hizo un trabajo excelente para ponernos cómodos y adaptó todo a nuestras preferencias. Vino preparada con algunas preguntas geniales que nos ayudaron a conectar y consiguió captar momentos genuinos. También fue genial poder pasar un rato charlando con ella y con Fernando. Las fotos quedaron increíbles. No podríamos haber pedido una mejor experiencia.",
      fr: "Nous avons vécu une superbe expérience avec Patricia ! Nous étions en visite à Lisbonne depuis le Canada et le processus de réservation a été super simple. Patricia a été très réactive et nous avons trouvé une date, un horaire et un lieu qui s'intégraient bien à nos vacances. Le jour de l'expérience, Patricia a fait un travail excellent pour nous mettre à l'aise et a adapté la séance à nos préférences. Elle est arrivée préparée avec d'excellentes questions qui nous ont aidés à nous connecter, et elle a su capturer des moments authentiques. C'était aussi un plaisir de passer du temps à discuter avec elle et Fernando. Les photos sont incroyables. Nous n'aurions pas pu demander mieux.",
    },
  },
  {
    id: "887b2653-dd37-4eb6-9ff2-af8accedd47d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Quero deixar o meu feedback sobre a sessão fotográfica. Superou mesmo as minhas expectativas! Adorei o resultado final; ficou exatamente como tinha imaginado (ou ainda melhor) e sinto que vai ser uma grande ajuda para a minha marca. Transmite na perfeição quem sou e o que faço dentro da medicina integrativa. A Patricia tem um dom natural. Eu estava muito nervosa, mas ela orienta muito e deixa as pessoas à vontade. Obrigada pela experiência ❤️",
      de: "Ich möchte mein Feedback zum Fotoshooting hinterlassen. Es hat meine Erwartungen wirklich übertroffen! Ich habe das Endergebnis geliebt — es ist genau so geworden, wie ich es mir vorgestellt habe (oder sogar noch besser), und ich glaube, es wird meiner Marke sehr helfen. Es vermittelt perfekt, wer ich bin und was ich im Bereich der integrativen Medizin tue. Patricia hat ein natürliches Talent. Ich war sehr nervös, aber sie gibt viel Anleitung und lässt einen sich wohlfühlen. Danke für die Erfahrung ❤️",
      es: "Quiero dejar mi feedback sobre la sesión de fotos. ¡De verdad superó mis expectativas! Me encantó el resultado final; quedó exactamente como lo había imaginado (o incluso mejor), y siento que va a ser una gran ayuda para mi marca. Transmite a la perfección quién soy y lo que hago dentro de la medicina integrativa. Patricia tiene un don natural. Estaba muy nerviosa, pero da muchas indicaciones y pone a la gente cómoda. Gracias por la experiencia ❤️",
      fr: "Je veux laisser mon retour sur la séance photo. Cela a vraiment dépassé mes attentes ! J'ai adoré le résultat final ; c'est exactement comme je l'avais imaginé (voire même mieux), et je sens que ce sera une vraie aide pour ma marque. Cela transmet parfaitement qui je suis et ce que je fais dans le domaine de la médecine intégrative. Patricia a un don naturel. J'étais très stressée, mais elle guide beaucoup et met les gens à l'aise. Merci pour cette expérience ❤️",
    },
  },
  {
    id: "dd4d0797-c661-43c6-ba95-23ebd27a2ee7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Pedi uma sessão fotográfica profissional para um serviço que ofereço. Adorei todas as fotos. Conseguiram captar a essência, a simplicidade (que é um dos pontos-chave do serviço) e tirar fotos para redes sociais (que era o meu objetivo), mas também outras mais profissionais ou divertidas. Dizer só \"obrigada\" é pouco!",
      de: "Ich habe ein professionelles Fotoshooting für ein Angebot von mir gebucht. Ich habe alle Fotos geliebt. Sie haben es geschafft, die Essenz und die Schlichtheit einzufangen (was einer der zentralen Punkte des Angebots ist) und Fotos für Social Media zu machen (was mein Ziel war), aber auch eher professionelle oder verspielte Aufnahmen. Ein einfaches „Danke\" reicht da gar nicht!",
      es: "Pedí una sesión fotográfica profesional para un servicio que ofrezco. Me encantaron todas las fotos. Consiguieron captar la esencia, la sencillez (que es uno de los puntos clave del servicio), hacer fotos para redes sociales (que era mi objetivo), pero también otras más profesionales o divertidas. ¡Decir solo \"gracias\" se queda corto!",
      fr: "J'ai demandé une séance photo professionnelle pour un service que je propose. J'ai adoré toutes les photos. Ils ont réussi à capturer l'essence, la simplicité (qui est l'un des points clés du service), à faire des photos pour les réseaux sociaux (ce qui était mon objectif), mais aussi des images plus pro ou plus ludiques. Un simple \"merci\" est largement insuffisant !",
    },
  },
  {
    id: "9052b1e0-ec72-4189-9b65-0eaba0cdc699",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Olá Ola, acabei de te enviar as fotos selecionadas! Estou absolutamente encantada 😍🥰 Vai ser uma recordação maravilhosa para nós, muito obrigada! Escolhi o pacote maxi — a seleção foi incrivelmente difícil 😅",
      de: "Hallo Ola, ich habe dir gerade die ausgewählten Fotos geschickt! Ich bin absolut begeistert 😍🥰 Das wird eine wunderbare Erinnerung für uns, vielen Dank! Ich habe das Maxi-Paket gewählt — die Auswahl war unglaublich schwierig 😅",
      es: "¡Hola Ola, acabo de enviarte las fotos seleccionadas! Estoy absolutamente encantada 😍🥰 Va a ser un recuerdo maravilloso para nosotros, ¡muchas gracias! Elegí el paquete maxi — la selección fue increíblemente difícil 😅",
      fr: "Coucou Ola, je viens de t'envoyer les photos sélectionnées ! Je suis absolument enchantée 😍🥰 Ce sera un magnifique souvenir pour nous, merci beaucoup ! J'ai choisi le pack maxi — la sélection a été incroyablement difficile 😅",
    },
  },
  {
    id: "a814dbbf-0559-447a-9da3-d695721c85f0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis é um fotógrafo extraordinário!! Encontrámo-lo através do AirBnb Services para tirar fotos dos nossos alunos enquanto estudavam no estrangeiro em Lisboa, Portugal, este verão, através da nossa empresa, LeadAbroad. Foi incrivelmente simpático, divertido e educado — todos os nossos alunos só falaram bem dele. Tornou todo o processo agradável e fácil. Vejam as fotos abaixo! Recomendo VIVAMENTE.",
      de: "Denis ist ein außergewöhnlicher Fotograf!! Wir haben ihn über AirBnb Services gefunden, um Fotos unserer Studierenden zu machen, die diesen Sommer mit unserer Firma LeadAbroad in Lissabon, Portugal, im Auslandsstudium waren. Er war unglaublich freundlich, lustig und höflich — alle unsere Studierenden waren begeistert von ihm. Er hat den gesamten Prozess angenehm und unkompliziert gemacht. Schaut euch die Bilder unten an! ABSOLUT zu empfehlen.",
      es: "¡Denis es un fotógrafo extraordinario! Lo encontramos a través de AirBnb Services para hacer fotos a nuestros estudiantes mientras estudiaban en el extranjero en Lisboa, Portugal, este verano, a través de nuestra empresa, LeadAbroad. Fue increíblemente amable, divertido y educado — todos nuestros estudiantes hablaban maravillas de él. Hizo que todo el proceso fuera muy ameno y fácil. ¡Mirad las fotos! MUY recomendable.",
      fr: "Denis est un photographe extraordinaire !! Nous l'avons trouvé via AirBnb Services pour photographier nos étudiants pendant leur séjour d'étude à Lisbonne, au Portugal, cet été, par le biais de notre entreprise, LeadAbroad. Il a été incroyablement gentil, drôle et poli — tous nos étudiants ont été dithyrambiques à son sujet. Il a rendu tout le processus très agréable et facile. Regardez ses photos ci-dessous ! Je le recommande VIVEMENT.",
    },
  },
  {
    id: "44b3b8c9-fff6-41b2-8e8f-12ea445fd38a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos uma experiência excelente a trabalhar com o Denis. O seu profissionalismo e talento notam-se mesmo nas fotos que captou. Para além das suas competências, foi incrivelmente simpático, acessível, e tornou todo o processo agradável. Não podíamos estar mais felizes com o resultado e recomendamos sem dúvida a quem procurar um fotógrafo.",
      de: "Wir hatten eine ausgezeichnete Erfahrung mit Denis. Seine Professionalität und sein Talent kommen in den Fotos, die er gemacht hat, wirklich zum Ausdruck. Über seine Fähigkeiten hinaus war er unglaublich nett, unkompliziert und hat den gesamten Prozess angenehm gestaltet. Wir könnten mit dem Ergebnis nicht zufriedener sein und würden ihn jedem empfehlen, der einen Fotografen sucht.",
      es: "Tuvimos una experiencia excelente trabajando con Denis. Su profesionalidad y talento se notan en las fotos que captó. Más allá de sus habilidades, fue increíblemente amable, cercano e hizo que todo el proceso fuera agradable. No podíamos estar más contentos con el resultado y, sin duda, lo recomendaríamos a cualquiera que busque un fotógrafo.",
      fr: "Nous avons vécu une expérience excellente avec Denis. Son professionnalisme et son talent transparaissent vraiment dans les photos qu'il a prises. Au-delà de ses compétences, il a été incroyablement gentil, accessible et a rendu tout le processus très agréable. Nous ne pourrions pas être plus contents du résultat et nous le recommanderions sans hésiter à toute personne cherchant un photographe.",
    },
  },
  {
    id: "23826fcf-288e-4aae-abf5-ea29b2dc5ef7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis foi o nosso fotógrafo de casamento e foi simplesmente incrível — as fotos são muito especiais.",
      de: "Denis war unser Hochzeitsfotograf und einfach großartig — die Fotos sind ganz besonders.",
      es: "Denis fue nuestro fotógrafo de boda y fue simplemente increíble — las fotos son muy especiales.",
      fr: "Denis a été notre photographe de mariage et il a été tout simplement incroyable — les photos sont très spéciales.",
    },
  },
  {
    id: "b9b1fdc4-1a85-411a-848e-b28ef7ba0ee4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis é um fotógrafo talentoso e paciente, com um olhar artístico.",
      de: "Denis ist ein talentierter und geduldiger Fotograf mit einem künstlerischen Blick.",
      es: "Denis es un fotógrafo talentoso y paciente, con una mirada muy artística.",
      fr: "Denis est un photographe talentueux et patient, avec un œil artistique.",
    },
  },
  {
    id: "ef67a985-b48e-41c3-974f-69e82ff4e7a7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos a sorte de ter o Denis como fotógrafo do nosso casamento e não podíamos ter sonhado com nada melhor! Desde o primeiro momento, deixou-nos à vontade com a sua simpatia, discrição e bom humor contagiante. Criou também uma ligação maravilhosa com os nossos convidados, o que contribuiu para uma atmosfera descontraída e natural ao longo de todo o dia. Mas, para além da experiência no local, o verdadeiro destaque foi receber as fotos… apenas 5 dias depois do casamento! E que fotos! ✨ O Denis tem um verdadeiro talento para captar emoções, olhares e aqueles pequenos momentos espontâneos que nem damos por eles na altura. Cada foto conta uma história e mergulha-nos vivamente nos momentos que vivemos. Um enorme obrigado, Denis, pelo teu trabalho excecional, pela tua sensibilidade artística e pelo teu profissionalismo. Estamos muito felizes por te termos tido ao nosso lado neste dia único. Recomendamos-te sem hesitação ❤️",
      de: "Wir hatten das Glück, Denis als Fotografen unserer Hochzeit zu haben, und wir hätten uns nichts Besseres erträumen können! Vom ersten Moment an hat er uns mit seiner Freundlichkeit, Diskretion und ansteckend guten Laune entspannen lassen. Er hat auch eine wundervolle Verbindung zu unseren Gästen aufgebaut, was zu einer entspannten, natürlichen Atmosphäre über den gesamten Tag beigetragen hat. Aber neben dem Erlebnis vor Ort war das wahre Highlight, die Fotos zu bekommen… nur 5 Tage nach der Hochzeit! Und was für Fotos! ✨ Denis hat ein echtes Talent dafür, Emotionen, Blicke und diese kleinen, spontanen Momente einzufangen, die einem im Augenblick selbst gar nicht auffallen. Jedes Foto erzählt eine Geschichte und lässt uns die Momente lebhaft wiedererleben. Ein riesiges Dankeschön, Denis, für deine außergewöhnliche Arbeit, deine künstlerische Sensibilität und deine Professionalität. Wir sind so glücklich, dass du uns an diesem einzigartigen Tag begleitet hast. Wir empfehlen dich ohne zu zögern ❤️",
      es: "¡Tuvimos la suerte de tener a Denis como fotógrafo de nuestra boda y no podríamos haber soñado con nada mejor! Desde el primer momento nos puso cómodos con su amabilidad, discreción y buen humor contagioso. Además, creó una conexión maravillosa con nuestros invitados, lo que contribuyó a un ambiente relajado y natural durante todo el día. Pero más allá de la experiencia en el sitio, el verdadero gran momento fue recibir las fotos… ¡solo 5 días después de la boda! ¡Y qué fotos! ✨ Denis tiene un verdadero talento para captar emociones, miradas y esos pequeños momentos espontáneos de los que ni te das cuenta en el momento. Cada foto cuenta una historia y nos sumerge con fuerza en los instantes que vivimos. Mil gracias, Denis, por tu trabajo excepcional, tu sensibilidad artística y tu profesionalidad. Estamos muy felices de haberte tenido a nuestro lado en este día único. Te recomendamos sin dudarlo ❤️",
      fr: "Nous avons eu la chance d'avoir Denis comme photographe pour notre mariage, et nous n'aurions pas pu rêver mieux ! Dès le premier instant, il nous a mis à l'aise avec sa gentillesse, sa discrétion et sa bonne humeur communicative. Il a aussi créé un lien formidable avec nos invités, ce qui a contribué à une ambiance détendue et naturelle tout au long de la journée. Mais au-delà de l'expérience sur place, le vrai point fort a été de recevoir les photos… à peine 5 jours après le mariage ! Et quelles photos ! ✨ Denis a un véritable talent pour capter les émotions, les regards et ces petits moments spontanés que l'on ne remarque même pas sur le moment. Chaque photo raconte une histoire et nous replonge intensément dans les instants que nous avons vécus. Un immense merci, Denis, pour ton travail exceptionnel, ta sensibilité artistique et ton professionnalisme. Nous sommes tellement heureux de t'avoir eu à nos côtés pour cette journée unique. Nous te recommandons sans hésiter ❤️",
    },
  },
  {
    id: "8fd81ceb-cf98-4064-b9e7-6bbfceae8bbd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratámos o Denis para o nosso casamento e estamos absolutamente entusiasmados! O profissionalismo, a discrição e a simpatia dele permitiram-nos aproveitar plenamente o dia e, ao mesmo tempo, criar memórias maravilhosas. As fotos têm uma qualidade excecional, são naturais e cheias de emoção. Recomendamos calorosamente o Denis a quem procurar um fotógrafo apaixonado e de confiança. Mil obrigados! 🙏🤩",
      de: "Wir haben Denis für unsere Hochzeit gebucht und sind absolut begeistert! Seine Professionalität, Diskretion und Freundlichkeit haben es uns ermöglicht, den Tag in vollen Zügen zu genießen und gleichzeitig wundervolle Erinnerungen zu schaffen. Die Fotos sind von außergewöhnlicher Qualität, natürlich und voller Emotion. Wir empfehlen Denis von Herzen jedem, der einen leidenschaftlichen und vertrauenswürdigen Fotografen sucht. Tausend Dank! 🙏🤩",
      es: "¡Contratamos a Denis para nuestra boda y estamos absolutamente encantados! Su profesionalidad, discreción y amabilidad nos permitieron disfrutar plenamente del día y, a la vez, crear unos recuerdos maravillosos. Las fotos tienen una calidad excepcional, son naturales y están llenas de emoción. Recomendamos calurosamente a Denis a quien busque un fotógrafo apasionado y de confianza. ¡Mil gracias! 🙏🤩",
      fr: "Nous avons engagé Denis pour notre mariage et nous sommes absolument ravis ! Son professionnalisme, sa discrétion et sa gentillesse nous ont permis de profiter pleinement de la journée tout en créant de magnifiques souvenirs. Les photos sont d'une qualité exceptionnelle, naturelles et pleines d'émotion. Nous recommandons chaleureusement Denis à toute personne cherchant un photographe passionné et digne de confiance. Mille mercis ! 🙏🤩",
    },
  },
  {
    id: "e553d8a8-c81f-41ca-9190-6ce5cb31f46d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis fez um trabalho fantástico nas fotos! Estamos encantados com os resultados. Fez-nos sentir confortáveis logo desde o início, captando momentos naturais e autênticos e oferecendo, ao mesmo tempo, ideias criativas. Recomendamos vivamente.",
      de: "Denis hat bei den Fotos einen fantastischen Job gemacht! Wir sind begeistert vom Ergebnis. Er hat uns von Anfang an entspannt sein lassen, natürliche und authentische Momente eingefangen und gleichzeitig kreative Ideen eingebracht. Sehr zu empfehlen.",
      es: "¡Denis hizo un trabajo fantástico con las fotos! Estamos encantadísimos con los resultados. Nos hizo sentir cómodos desde el primer momento, captando momentos naturales y auténticos y, a la vez, ofreciendo ideas creativas. Lo recomendamos muchísimo.",
      fr: "Denis a fait un travail fantastique sur les photos ! Nous sommes ravis du résultat. Il nous a mis à l'aise dès le début, en capturant des moments naturels et authentiques tout en proposant des idées créatives. Nous le recommandons vivement.",
    },
  },
  {
    id: "f2c93ed3-9c38-4a37-a9dd-5e1154bbd3db",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Pedimos ao Denis para fazer uma sessão fotográfica durante uma despedida de solteiro/solteira na Costa da Caparica. Foi muito disponível e a interação dele com o grupo foi fantástica, porque é tão positivo e motivador. As fotos estão absolutamente deslumbrantes! Chegaram exatamente a horas. Obrigada, Denis, por este trabalho incrível. Ficamos com memórias maravilhosas deste momento juntos. Estamos encantados!",
      de: "Wir haben Denis gefragt, ob er ein Shooting während eines Junggesellinnen-/Junggesellenabschieds an der Costa da Caparica machen kann. Er war sehr flexibel, und seine Interaktion mit der Gruppe war fantastisch, weil er einfach so positiv und motivierend ist. Die Fotos sind absolut atemberaubend! Sie kamen genau pünktlich. Danke, Denis, für diese großartige Arbeit. Wir haben wunderschöne Erinnerungen an diese gemeinsame Zeit. Wir sind begeistert!",
      es: "Le pedimos a Denis que hiciera una sesión durante una despedida de soltero/soltera en la Costa de Caparica. Fue muy atento y su interacción con el grupo fue fantástica, porque es muy positivo y motivador. ¡Las fotos están absolutamente impresionantes! Llegaron exactamente cuando dijo. Gracias, Denis, por este trabajo increíble. Nos llevamos unos recuerdos maravillosos de este momento juntos. ¡Estamos encantados!",
      fr: "Nous avons demandé à Denis de faire une séance photo lors d'un EVJF/EVG à la Costa da Caparica. Il a été très réactif et son interaction avec le groupe a été fantastique, parce qu'il est tellement positif et motivant. Les photos sont absolument magnifiques ! Elles sont arrivées pile à l'heure prévue. Merci, Denis, pour ce travail incroyable. Nous avons de magnifiques souvenirs de ce moment partagé. Nous sommes ravis !",
    },
  },
  {
    id: "38130a05-7894-4e0c-abdf-6e777bbbeffb",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Escolhemos o Denis para as fotos do nosso casamento e estamos muito satisfeitos com o resultado! É muito profissional e simpático. Recomendo!",
      de: "Wir haben Denis für unsere Hochzeitsfotos ausgewählt und sind sehr zufrieden mit dem Ergebnis! Er ist sehr professionell und freundlich. Sehr zu empfehlen!",
      es: "¡Elegimos a Denis para las fotos de nuestra boda y estamos muy contentos con el resultado! Es muy profesional y amable. ¡Lo recomiendo!",
      fr: "Nous avons choisi Denis pour les photos de notre mariage et nous sommes très satisfaits du résultat ! Il est très professionnel et sympathique. Je recommande !",
    },
  },
  {
    id: "691116b4-ab4b-42fa-b135-6b43da3d368d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratei o Denis para uma sessão fotográfica para o meu site e, mais tarde, para uma sessão de família; foi sempre muito atento, cheio de bons conselhos, muito simpático e fez tudo para nos satisfazer. Recomendo vivamente!",
      de: "Ich habe Denis für ein Shooting für meine Website und später für ein Familien-Shooting gebucht; er war immer sehr aufmerksam, voller guter Ratschläge, sehr sympathisch und hat alles dafür getan, dass wir zufrieden sind. Sehr zu empfehlen!",
      es: "Contraté a Denis para una sesión para mi web y, en otra ocasión, para una sesión familiar; siempre fue muy atento, lleno de buenos consejos, muy amable, e hizo todo lo posible por dejarnos contentos. ¡Lo recomiendo muchísimo!",
      fr: "J'ai engagé Denis pour une séance photo pour mon site web et une autre fois pour une séance famille ; il a toujours été très attentif, plein de bons conseils, très sympathique, et a tout fait pour nous satisfaire. Je le recommande vivement !",
    },
  },
  {
    id: "92caffbe-c963-48ad-8526-95f8dc20799b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Profissional, disponível, e o resultado é simplesmente artístico e tocante ;-)",
      de: "Professionell, verfügbar — und das Ergebnis ist einfach künstlerisch und berührend ;-)",
      es: "Profesional, disponible, y el resultado es simplemente artístico y emocionante ;-)",
      fr: "Professionnel, disponible, et le résultat est tout simplement artistique et émouvant ;-)",
    },
  },
  {
    id: "24bc33bd-915e-49c0-9cab-4915bf7fed67",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "No momento em que vi a forma como a Isa capta os momentos, soube que era ela que eu queria. Passámos um momento incrível com ela. É muito simpática e gentil. Todas as fotos foram naturais, espontâneas, e aceitou sempre as nossas sugestões com gosto. O meu filho de 6 anos adorou-a e voltaria a recorrer a ela. Recomendo vivamente.",
      de: "In dem Moment, in dem ich gesehen habe, wie Isa Momente einfängt, wusste ich: Sie soll es sein. Wir hatten eine fantastische Zeit mit ihr. Sie ist sehr freundlich und herzlich. Alle ihre Aufnahmen waren natürlich und spontan, und sie hat unsere Anregungen gern aufgenommen. Mein Sechsjähriger hat sie geliebt, und ich würde jederzeit wieder zu ihr kommen. Sehr zu empfehlen.",
      es: "En el momento en que vi cómo Isa captaba los momentos, supe que era ella la que quería. Pasamos un rato genial con ella. Es muy amable y simpática. Todos sus clics fueron naturales, espontáneos, y aceptó con gusto nuestras sugerencias. A mi hijo de 6 años le encantó, y volvería a contar con ella sin pensarlo. La recomiendo muchísimo.",
      fr: "Dès que j'ai vu la façon dont Isa capturait les moments, j'ai su que c'était elle que je voulais. Nous avons passé un moment formidable avec elle. Elle est très sympathique et gentille. Tous ses clichés étaient naturels, spontanés, et elle a accueilli nos suggestions avec plaisir. Mon enfant de 6 ans l'a adorée, et je ferais à nouveau appel à elle sans hésiter. Je la recommande vivement.",
    },
  },
  {
    id: "4b231220-030b-4113-9a09-7005ea06ecf0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A minha experiência com a Isa, na sessão de família, foi excelente; o ambiente foi descontraído e tranquilo, fazendo-nos sentir confortáveis a todo o momento. As fotos ficaram lindíssimas. Recomendo vivamente o seu trabalho.",
      de: "Meine Erfahrung mit Isa beim Familienshooting war ausgezeichnet; die Atmosphäre war entspannt und ruhig, sodass wir uns die ganze Zeit über wohlgefühlt haben. Die Fotos sind wunderschön geworden. Ich empfehle ihre Arbeit wärmstens.",
      es: "Mi experiencia con Isa en la sesión familiar fue excelente; el ambiente fue relajado y tranquilo, lo que nos hizo sentir cómodos en todo momento. Las fotos quedaron preciosísimas. Recomiendo muchísimo su trabajo.",
      fr: "Mon expérience avec Isa lors de la séance famille a été excellente ; l'ambiance était détendue et paisible, ce qui nous a mis à l'aise à chaque instant. Les photos sont magnifiques. Je recommande vivement son travail.",
    },
  },
  {
    id: "cd79ccb9-7067-4a03-9de9-5084adceee04",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ficámos encantados com o trabalho deles. A qualidade das fotos é excecional, foram muito flexíveis quanto à hora e ao local da sessão, o serviço foi simpático e personalizado do início ao fim, e tudo a um preço muito razoável.",
      de: "Wir waren von ihrer Arbeit begeistert. Die Qualität der Fotos ist herausragend, sie waren sehr flexibel, was Zeit und Ort des Shootings betrifft, der Service war von Anfang bis Ende freundlich und persönlich — und das alles zu einem sehr fairen Preis.",
      es: "Quedamos encantados con su trabajo. La calidad de las fotos es excepcional, fueron muy flexibles con la hora y el lugar de la sesión, el trato fue cercano y personalizado de principio a fin, y todo a un precio muy razonable.",
      fr: "Nous avons été ravis de leur travail. La qualité des photos est exceptionnelle, ils ont été très flexibles sur l'heure et le lieu de la séance, le service a été chaleureux et personnel du début à la fin, et tout cela à un prix très raisonnable.",
    },
  },
  {
    id: "605d0525-9e01-490c-bf59-6a4d77f57a71",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A fotógrafa é muito enérgica e simpática. Faz-nos sentir confortáveis e tira uma grande variedade de fotos. Estamos extremamente satisfeitos!",
      de: "Die Fotografin ist sehr energiegeladen und freundlich. Sie sorgt dafür, dass man sich wohlfühlt, und macht eine große Vielfalt an Fotos. Wir sind extrem zufrieden!",
      es: "La fotógrafa es muy enérgica y amable. Te hace sentir cómoda y hace una gran variedad de fotos. ¡Estamos extremadamente contentos!",
      fr: "La photographe est très énergique et sympathique. Elle vous met à l'aise et prend une grande variété de photos. Nous sommes extrêmement satisfaits !",
    },
  },
  {
    id: "71939e56-2724-4bd6-ae72-76088050846a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "É uma artista, uma visionária, e nota-se no seu trabalho! Fotos lindas, ângulos criativos e um verdadeiro olho para captar momentos.",
      de: "Sie ist eine Künstlerin, eine Visionärin — und das spürt man in ihrer Arbeit! Wunderschöne Bilder, kreative Perspektiven und ein echter Blick für besondere Momente.",
      es: "Es una artista, una visionaria, ¡y se nota en su trabajo! Fotos preciosas, ángulos creativos y un verdadero ojo para captar momentos.",
      fr: "Elle est une artiste, une visionnaire, et cela se voit dans son travail ! De superbes photos, des angles créatifs et un vrai œil pour capter les moments.",
    },
  },
  {
    id: "77ae2009-50d3-49e5-86cc-6c1921912ebc",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalhar com a Vik foi um sopro. Os locais que escolheu, a par da sua experiência, foram ótimos. Indica-nos como e o que fazer nas poses. Voltaria a trabalhar com ela sem dúvida! 5 estrelas!",
      de: "Mit Vik zu arbeiten war ein Kinderspiel. Die Locations, die sie ausgesucht hat, und ihre Expertise waren großartig. Sie sagt einem, wie und welche Posen man machen soll. Ich würde jederzeit wieder mit ihr arbeiten! 5 Sterne!",
      es: "Trabajar con Vik fue una maravilla. Los sitios que eligió y su experiencia fueron geniales. Te indica cómo y qué hacer en cada pose. ¡Sin duda volvería a trabajar con ella! ¡5 estrellas!",
      fr: "Travailler avec Vik a été un vrai bonheur. Les lieux qu'elle a choisis et son expertise étaient super. Elle vous indique comment et quoi faire pour les poses. Je travaillerais à nouveau avec elle sans hésiter ! 5 étoiles !",
    },
  },
  {
    id: "1cf54bc7-cb7f-486b-a427-9dc238f4dba0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Vik é uma fotógrafa incrível! Os locais para onde nos levou foram fantásticos. Vimos as amostras da nossa sessão e adorámos. Mal posso esperar para ver as fotos finais.",
      de: "Vik ist eine fantastische Fotografin! Die Locations, an die sie uns mitgenommen hat, waren großartig. Wir haben die Vorschau unserer Bilder gesehen und sind begeistert. Ich kann es kaum erwarten, die finalen Fotos zu sehen.",
      es: "¡Vik es una fotógrafa increíble! Los sitios a los que nos llevó fueron geniales. Vimos las muestras de nuestra sesión y nos encantaron. ¡No veo la hora de ver las fotos finales!",
      fr: "Vik est une photographe incroyable ! Les endroits où elle nous a emmenés étaient géniaux. Nous avons vu les aperçus de notre séance et nous avons adoré. J'ai hâte de voir les photos finales.",
    },
  },
  {
    id: "06124032-22c7-4fc2-9c9a-7a6b6c179909",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia fez um trabalho maravilhoso comigo e com a minha mãe. Marcámos a sessão prolongada para fotos individuais e fotos mãe/filha. A Viktoriia escolheu cenários/fundos incríveis e foi muito paciente connosco (eu e a minha mãe não somos muito à vontade em frente à câmara!). Recomendo vivamente esta sessão!",
      de: "Viktoriia hat mit meiner Mutter und mir wundervolle Arbeit geleistet. Wir hatten die verlängerte Session gebucht, mit Einzelfotos und Mutter-Tochter-Bildern. Viktoriia hat tolle Szenen und Hintergründe ausgewählt und war sehr geduldig mit uns beiden (meine Mutter und ich sind vor der Kamera nicht besonders entspannt!). Ich kann dieses Shooting nur wärmstens empfehlen!",
      es: "Viktoriia hizo un trabajo maravilloso con mi madre y conmigo. Reservamos la sesión extendida con fotos individuales y fotos madre/hija. Viktoriia eligió escenas/fondos increíbles y fue muy paciente con nosotras (¡mi madre y yo no estamos muy cómodas delante de la cámara!). ¡Recomiendo muchísimo reservar una sesión!",
      fr: "Viktoriia a fait un travail formidable avec ma mère et moi. Nous avions réservé la séance prolongée pour des photos individuelles et mère/fille. Viktoriia a choisi des décors et des arrière-plans superbes et a été très patiente avec nous deux (ma mère et moi ne sommes pas très à l'aise devant un objectif !). Je recommande vivement de réserver une séance !",
    },
  },
  {
    id: "e9b60bb6-54c9-4725-a14e-916e848c26d6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi um prazer enorme conhecer a Viktoriia! Divertimo-nos imenso na sessão fotográfica. Levou-nos a sítios que nem sabíamos que existiam! Emprestou-me um vestido que fez toda a diferença! Recomendo vivamente.",
      de: "Es war eine Freude, Viktoriia kennenzulernen! Wir hatten beim Shooting riesigen Spaß. Sie hat uns zu Orten gebracht, von denen wir nicht einmal wussten, dass es sie gibt! Sie hat mir sogar ein Kleid geliehen, was wirklich einen Unterschied gemacht hat! Sehr zu empfehlen.",
      es: "¡Fue un placer enorme conocer a Viktoriia! Nos divertimos muchísimo en la sesión. Nos llevó a sitios que ni sabíamos que existían. Me dejó un vestido que marcó la diferencia. ¡La recomiendo totalmente!",
      fr: "Quel plaisir de rencontrer Viktoriia ! Nous nous sommes énormément amusés pendant la séance photo. Elle nous a emmenés dans des endroits dont on ne soupçonnait même pas l'existence ! Elle m'a même prêté une robe qui a vraiment fait la différence ! Je la recommande vivement.",
    },
  },
  {
    id: "b1fabcaf-ab7c-4c31-ab00-175ec3524109",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recebi fotos lindas como recordação de Lisboa. A fotógrafa foi simpática e amigável, escolhendo os melhores sítios para fotos com atmosfera. É muito profissional, ajuda nas poses e dá dicas para o melhor resultado. Recomendo vivamente esta experiência.",
      de: "Ich habe wunderschöne Fotos als Andenken aus Lissabon mit nach Hause genommen. Die Fotografin war nett und freundlich und hat die besten Spots für stimmungsvolle Bilder ausgesucht. Sie ist sehr professionell, hilft beim Posieren und gibt Tipps für das beste Ergebnis. Ich kann dieses Erlebnis sehr empfehlen.",
      es: "Conseguí unas fotos preciosas como recuerdo de Lisboa. La fotógrafa fue amable y simpática, eligiendo los mejores sitios para fotos con atmósfera. Es muy profesional, ayuda con las poses y da consejos para conseguir el mejor resultado. Recomiendo muchísimo esta experiencia.",
      fr: "J'ai obtenu de magnifiques photos en souvenir de Lisbonne. La photographe a été gentille et sympathique, en choisissant les meilleurs endroits pour des photos pleines d'atmosphère. Elle est très professionnelle, aide pour les poses et donne des conseils pour obtenir le meilleur résultat. Je recommande vivement cette expérience.",
    },
  },
  {
    id: "809d57a5-4f27-4cdb-9844-41f57e6b9c1c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia foi ÓTIMA! Foi pontual, simpática, deixou-me tirar fotos em vários locais e até se ofereceu para me arranjar um look. Como referem outras avaliações, também faz conteúdo para redes sociais. Estou super entusiasmada para ver as fotos!",
      de: "Viktoriia war GROSSARTIG! Sie war pünktlich, freundlich, hat mich an mehreren Orten fotografieren lassen und mir sogar angeboten, mir ein Outfit zur Verfügung zu stellen. Wie auch in anderen Bewertungen erwähnt, macht sie zudem Content für Social Media. Ich freue mich riesig darauf, die Fotos zu sehen!",
      es: "¡Viktoriia fue GENIAL! Fue puntual, amable, me dejó hacer fotos en muchos sitios e incluso me ofreció prestarme un outfit. Como dicen otras reseñas, también te crea contenido para redes sociales. ¡Tengo muchísimas ganas de ver las fotos!",
      fr: "Viktoriia a été GÉNIALE ! Ponctuelle, sympa, elle m'a laissée faire des photos dans plein d'endroits et m'a même proposé de me prêter une tenue. Comme d'autres avis le mentionnent, elle prend aussi du contenu pour les réseaux sociaux. J'ai hâte de voir les photos !",
    },
  },
  {
    id: "31b0bd93-baf2-4d56-b187-86991f5e864e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Enquadramento perfeito. Configurações de imagem perfeitas. Locais perfeitamente escolhidos. Foi um trabalho muito especial, feito com grande profissionalismo. Recomendo vivamente!",
      de: "Perfekter Bildaufbau. Perfekte Kameraeinstellungen. Perfekt ausgewählte Locations. Eine ganz besondere Arbeit, mit großem Profi-Niveau ausgeführt. Sehr zu empfehlen!",
      es: "Encuadre perfecto. Ajustes de imagen perfectos. Localizaciones perfectamente elegidas. Fue un trabajo muy especial, hecho con gran profesionalidad. ¡Lo recomiendo muchísimo!",
      fr: "Cadrage parfait. Réglages d'image parfaits. Lieux parfaitement choisis. Un travail très spécial, réalisé avec un grand professionnalisme. Je recommande vivement !",
    },
  },
  {
    id: "e3ee9945-3672-4325-9e53-15ca4dcda0f6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Estou grávida e fiz uma sessão de maternidade com o fotógrafo José Santos. Adorei a forma como interagimos, com tanta delicadeza e profissionalismo. As fotos estão lindas e tenciono que continue a documentar a minha gravidez. Foram muitas poses e todas elas resultaram em fotos inesquecíveis. Obrigada pelo trabalho e recomendo os seus serviços. Sr. José, continue a tratar os seus clientes com este profissionalismo, paciência e sabedoria. Beijinhos, Inês.",
      de: "Ich bin schwanger und hatte ein Babybauch-Shooting mit dem Fotografen José Santos. Ich habe es geliebt, wie wir miteinander umgegangen sind — mit so viel Höflichkeit und Professionalität. Die Fotos sind wunderschön, und ich plane, dass er meine Schwangerschaft weiter begleitet. Es waren viele Posen, und alle haben unvergessliche Bilder hervorgebracht. Danke für die Arbeit, ich empfehle seine Dienste sehr. Herr José, behandeln Sie Ihre Kund:innen weiterhin mit dieser Professionalität, Geduld und Weisheit. Küsschen, Inês.",
      es: "Estoy embarazada y tuve una sesión de maternidad con el fotógrafo José Santos. Me encantó la manera en que interactuamos, con tanta delicadeza y profesionalidad. Las fotos están preciosas y tengo intención de que siga documentando mi embarazo. Hicimos muchas poses y todas dieron lugar a fotos inolvidables. Gracias por el trabajo y recomiendo sus servicios. Sr. José, siga tratando a sus clientes con esta profesionalidad, paciencia y sabiduría. Besos, Inês.",
      fr: "Je suis enceinte et j'ai fait une séance grossesse avec le photographe José Santos. J'ai adoré la façon dont nous avons interagi, avec autant de délicatesse et de professionnalisme. Les photos sont magnifiques et je compte bien qu'il continue à documenter ma grossesse. Il y a eu beaucoup de poses et toutes ont donné lieu à des photos inoubliables. Merci pour ce travail et je recommande ses services. Monsieur José, continuez à traiter vos clients avec ce professionnalisme, cette patience et cette sagesse. Bises, Inês.",
    },
  },
  {
    id: "e8846e5b-b2e1-4489-a513-e361e8ae68d3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Excelente profissional. Recomendo, sem dúvida.",
      de: "Hervorragender Profi. Sehr zu empfehlen.",
      es: "Excelente profesional. Lo recomiendo, sin duda.",
      fr: "Excellent professionnel. Je recommande sans aucun doute.",
    },
  },
  {
    id: "b7a6928c-71e4-4dbc-ba17-2923f7a3defd",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma experiência fantástica com o Massimo na nossa sessão fotográfica de noivado — recomendo vivamente!",
      de: "Ich hatte eine fantastische Erfahrung mit Massimo bei unserem Verlobungsshooting — sehr zu empfehlen!",
      es: "¡Tuve una experiencia fantástica con Massimo en nuestra sesión de fotos de compromiso — lo recomiendo muchísimo!",
      fr: "J'ai vécu une expérience fantastique avec Massimo lors de notre séance photo de fiançailles — je le recommande vivement !",
    },
  },
  {
    id: "bc960c62-2f1e-4fde-8543-71c5b6cd0754",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O André foi-me buscar e levou-me ao hotel — toda a experiência foi incrível, e vou ter as fotos e as imagens de drone para a vida. Pessoa muito simpática, foi muito além do esperado para conseguir ótimas fotos. Recomendo vivamente.",
      de: "André hat mich am Hotel abgeholt und wieder zurückgebracht — das gesamte Erlebnis war fantastisch, und ich werde die Fotos und Drohnenaufnahmen ein Leben lang haben. Wirklich netter Typ, der weit über das Übliche hinausgegangen ist, um die besten Bilder zu bekommen. Sehr zu empfehlen.",
      es: "André me recogió y me llevó al hotel — toda la experiencia fue increíble, y voy a tener las fotos y las imágenes de dron para toda la vida. Persona muy maja, hizo mucho más de lo esperado para conseguir fotos geniales. Lo recomiendo muchísimo.",
      fr: "André est venu me chercher et m'a ramené à l'hôtel — toute l'expérience a été incroyable, et je garderai les photos et les images de drone à vie. Une personne très sympa, qui a fait bien plus que nécessaire pour obtenir d'excellentes photos. Je recommande vivement.",
    },
  },
  {
    id: "4c48656e-c323-4af5-8690-464e2280433b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Serviço excecional. Adoro viajar e viver cada destino. Quando conheci o André numa das minhas viagens à Ilha da Madeira, vivi algo excecional para mim — vivi mesmo a experiência e ainda recebi as melhores fotos que tenho na minha galeria.",
      de: "Außergewöhnlicher Service. Ich liebe es zu reisen und jedes Reiseziel zu erleben. Als ich André auf einer meiner Reisen nach Madeira kennengelernt habe, habe ich etwas Außergewöhnliches erlebt — ich habe das Erlebnis wirklich gelebt und obendrein die besten Fotos bekommen, die ich in meiner Galerie habe.",
      es: "Servicio excepcional. Me encanta viajar y vivir cada destino. Cuando conocí a André en uno de mis viajes a la isla de Madeira viví algo realmente excepcional — viví la experiencia de verdad y, además, obtuve las mejores fotos que tengo en mi galería.",
      fr: "Service exceptionnel. J'adore voyager et vivre chaque destination. Quand j'ai rencontré André lors de l'un de mes voyages à Madère, j'ai vécu quelque chose d'exceptionnel pour moi — j'ai vraiment vécu l'expérience et j'ai même reçu les plus belles photos que j'aie dans ma galerie.",
    },
  },
  {
    id: "ff81e5cb-fdeb-4794-8abb-3b9673c2459b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O melhor tour que já fiz! Vale 100% a pena. O André é uma excelente pessoa, e as fotos valem mesmo a pena. Sem dúvida que voltaria a contactá-lo!",
      de: "Die beste Tour, die ich je gemacht habe! Es lohnt sich zu 100 %. André ist ein toller Mensch, und die Fotos sind es absolut wert. Ich würde mich ohne Zögern wieder bei ihm melden!",
      es: "¡El mejor tour que he hecho nunca! Vale 100% la pena. André es una persona excelente, y las fotos merecen muchísimo la pena. ¡Sin duda volvería a contactarle!",
      fr: "Le meilleur tour que j'aie jamais fait ! Ça vaut 100 % le coup. André est une personne formidable, et les photos en valent vraiment la peine. Je le recontacterais sans aucun doute !",
    },
  },
  {
    id: "e062ac5d-1017-46c7-8111-a28bd500ad29",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos trabalhar com o Rui! Comunicação incrível, super flexível e as fotografias ficam maravilhosas! Para além de simpático, entregou as fotos em tempo recorde :D Sempre atento ao detalhe e com sugestões que tornam as fotografias únicas! Recomendo vivamente!",
      de: "Wir haben es geliebt, mit Rui zu arbeiten! Unglaubliche Kommunikation, super flexibel und die Fotos werden wunderschön! Er ist nicht nur sympathisch — er hat die Bilder auch in Rekordzeit geliefert :D Stets mit Liebe zum Detail und mit Vorschlägen, die jede Aufnahme einzigartig machen! Sehr zu empfehlen!",
      es: "¡Nos encantó trabajar con Rui! Comunicación increíble, súper flexible, y las fotos quedan preciosas. Además de simpático, ¡entregó las fotos en tiempo récord! :D Siempre atento al detalle y con sugerencias que hacen únicas las fotografías. ¡Lo recomiendo muchísimo!",
      fr: "Nous avons adoré travailler avec Rui ! Une communication incroyable, super flexible, et les photos sont magnifiques ! En plus d'être sympa, il a livré les photos en un temps record :D Toujours attentif au détail et avec des suggestions qui rendent les photos uniques ! Je recommande vivement !",
    },
  },
  {
    id: "5c5ab11e-2429-4d42-8458-497b5407d081",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Christina é a fotógrafa que apanha a vida. Não é sobre poses longas e penosas, é sobre o momento. Ela vê a beleza em ti e leva-a para a foto. É esse o grande valor destas imagens. São vivas, reais e cheias de emoção. É fácil trabalhar com a Kristina. Sucesso e crescimento para ela!",
      de: "Christina ist die Fotografin, die das Leben einfängt. Es geht nicht um lange, anstrengende Posen, sondern um den Moment. Sie sieht die Schönheit in dir und holt sie ins Bild. Genau das ist der große Wert dieser Aufnahmen. Sie sind lebendig, echt und emotional. Mit Kristina ist es einfach zu arbeiten. Viel Erfolg und Wachstum für sie!",
      es: "Christina es la fotógrafa que atrapa la vida. No va de poses largas y dolorosas, sino del momento. Ve la belleza en ti y la lleva a la foto. Ese es el gran valor de estas imágenes. Son vivas, reales y emocionantes. Es fácil trabajar con Kristina. ¡Éxito y crecimiento para ella!",
      fr: "Christina est la photographe qui capture la vie. Il ne s'agit pas de longues poses pénibles, mais du moment. Elle voit la beauté en toi et la transporte dans la photo. C'est ça la grande valeur de ces clichés. Ils sont vivants, réels et pleins d'émotion. Travailler avec Kristina est facile. Plein de succès et de progression pour elle !",
    },
  },
  {
    id: "84f5fdd9-67eb-49fa-abe3-b8d343287c8c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei a vibe que transmitiste na sessão — és calma e divertida, e foi tão bom fazê-lo! Adoro fazer sessões fotográficas e esta foi muito boa. E os resultados ficaram INCRÍVEIS. Fotos muito simples e íntimas, para celebrar o ser mulher 💃🏻❤️",
      de: "Ich habe die Vibes geliebt, die du beim Shooting rübergebracht hast — du bist ruhig und gleichzeitig lustig, und es war so toll! Ich liebe Fotoshootings, und dieses hier war einfach wunderschön. Und das Ergebnis war UNGLAUBLICH. Sehr schlichte, intime Fotos, die das Frausein feiern 💃🏻❤️",
      es: "Me encantó la vibe que transmitiste en la sesión — eres tranquila y divertida, ¡y fue genial hacerlo! Me encanta hacer sesiones de fotos y esta fue muy buena. Y los resultados quedaron INCREÍBLES. Fotos muy sencillas e íntimas, para celebrar el ser mujer 💃🏻❤️",
      fr: "J'ai adoré l'énergie que tu as apportée à la séance — tu es calme et drôle, et c'était tellement bien de la faire ! J'adore faire des séances photo et celle-ci a été vraiment géniale. Et les résultats sont INCROYABLES. Des photos très simples et intimes, pour célébrer le fait d'être femme 💃🏻❤️",
    },
  },
  {
    id: "95b63e60-39b5-4def-93c1-40e30482a7ea",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie tirou fotos lindas no nosso casamento, captando os momentos de forma maravilhosa, e foi tão descontraída que nos sentimos completamente naturais. Recomendo vivamente.",
      de: "Sophie hat wunderschöne Fotos auf unserer Hochzeit gemacht und die Momente ganz besonders eingefangen. Sie war so entspannt, dass wir uns vollkommen natürlich gefühlt haben. Sehr zu empfehlen.",
      es: "Sophie hizo unas fotos preciosas en nuestra boda, captando los momentos de forma maravillosa, y fue tan relajada que nos sentimos completamente naturales. La recomiendo muchísimo.",
      fr: "Sophie a fait de magnifiques photos à notre mariage, capturant les moments avec beaucoup de poésie, et elle était tellement détendue que nous nous sommes sentis complètement naturels. Je la recommande vivement.",
    },
  },
  {
    id: "088c68a2-8813-4438-8bc7-a97c14adbb53",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uma experiência absolutamente linda. Fizemos uma sessão de maternidade e, pessoalmente, não sou alguém que se sinta confortável em frente à câmara, mas, desde o momento em que conhecemos a Isa, fez-nos sentir muito relaxados. É uma pessoa tão maravilhosa, com uma energia linda — e, para coroar, tira as fotos mais lindas!! Estamos mais do que felizes com a nossa galeria. Captou de forma perfeita uma fase tão especial para nós. De certeza que vamos fazer outra sessão quando a menina chegar!! ❤️",
      de: "Eine absolut wunderschöne Erfahrung. Wir hatten ein Babybauch-Shooting, und ich persönlich fühle mich vor der Kamera überhaupt nicht wohl — aber von dem Moment an, in dem wir Isa getroffen haben, hat sie uns beide sehr entspannen lassen. Sie ist so ein wunderbarer Mensch mit einer wunderschönen Energie und macht obendrein die schönsten Fotos!! Wir sind mit unserer Galerie mehr als glücklich. Sie hat eine ganz besondere Zeit für uns einfach perfekt eingefangen. Wir werden ganz sicher ein weiteres Shooting machen, wenn unser Mädchen da ist!! ❤️",
      es: "Una experiencia absolutamente preciosa. Hicimos una sesión de maternidad y, personalmente, no soy alguien que se sienta cómoda delante de la cámara, pero desde el momento en que conocimos a Isa nos hizo sentir muy relajados a los dos. Es una persona maravillosa, con una energía preciosa, y por si fuera poco hace las fotos más bonitas. Estamos más que felices con nuestra galería. Captó de forma perfecta una fase tan especial para nosotros. ¡Sin duda haremos otra sesión cuando llegue nuestra niña! ❤️",
      fr: "Une expérience absolument magnifique. Nous avons fait une séance grossesse et, personnellement, je ne suis pas quelqu'un qui se sent à l'aise devant un objectif, mais dès le moment où nous avons rencontré Isa, elle nous a tous les deux mis très à l'aise. C'est une personne merveilleuse, avec une magnifique énergie, et en plus elle prend des photos sublimes !! Nous sommes plus qu'heureux de notre galerie. Elle a parfaitement capturé un moment si spécial pour nous. Nous referons sans aucun doute une séance quand notre petite fille arrivera !! ❤️",
    },
  },
  {
    id: "9dec6751-8ff8-4525-a15d-5a1f1668a22e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Isa foi incrível em todos os aspetos, fez-nos sentir super à vontade e adorámos a sua simpatia. Vai de certeza ser convidada para mais eventos nossos. Muito obrigada! 😘",
      de: "Isa war in jeder Hinsicht großartig — sie hat uns absolut entspannen lassen und wir haben ihre Freundlichkeit geliebt. Sie wird ganz sicher zu weiteren unserer Events eingeladen. Vielen Dank! 😘",
      es: "Isa fue increíble en todos los sentidos, nos hizo sentir súper cómodos y nos encantó su simpatía. Sin duda la invitaremos a más eventos nuestros. ¡Mil gracias! 😘",
      fr: "Isa a été incroyable à tous points de vue, elle nous a mis super à l'aise et nous avons adoré sa gentillesse. On lui demandera sans hésiter de revenir pour d'autres événements. Merci beaucoup ! 😘",
    },
  },
  {
    id: "098689af-bcf9-433f-834a-193a4ebbeea8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Excelente profissional, muito simpática e disponível para ouvir o que queríamos registar no nosso evento. Muito calma a dar as indicações e a apoiar cada pessoa e o grupo. Não podíamos estar mais satisfeitos e gratos! 🔝",
      de: "Hervorragende Profi, sehr freundlich und offen dafür zuzuhören, was wir bei unserem Event festgehalten haben wollten. Sehr ruhig beim Erklären und sehr unterstützend für jede einzelne Person und für die Gruppe. Wir könnten nicht zufriedener und dankbarer sein! 🔝",
      es: "Excelente profesional, muy amable y dispuesta a escuchar lo que queríamos registrar en nuestro evento. Muy tranquila al dar las indicaciones y apoyando a cada persona y al grupo. ¡No podíamos estar más satisfechos y agradecidos! 🔝",
      fr: "Excellente professionnelle, très sympathique et à l'écoute de ce que nous voulions immortaliser lors de notre événement. Très calme dans ses indications et soutenant chaque personne et le groupe. Nous ne pourrions pas être plus satisfaits et reconnaissants ! 🔝",
    },
  },
  {
    id: "7c12e672-5d73-42ca-bf0c-ad0d0e226533",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Experiência maravilhosa, uma pessoa muito profissional e simpática — as fotos ficaram perfeitas!",
      de: "Wundervolle Erfahrung, eine sehr professionelle und freundliche Person — die Fotos sind perfekt geworden!",
      es: "¡Experiencia maravillosa, una persona muy profesional y simpática — las fotos quedaron perfectas!",
      fr: "Une expérience merveilleuse, une personne très professionnelle et sympathique — les photos sont parfaites !",
    },
  },
  {
    id: "fa0e2cf0-5624-4da9-8d11-55cf163aac1f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi uma experiência maravilhosa! Recomendo vivamente esta sessão fotográfica em Lisboa — é um prazer trabalhar com a Viktoriia e as fotos ficaram ótimas.",
      de: "Es war eine wundervolle Erfahrung! Ich kann dieses Foto-Shooting in Lissabon nur empfehlen — mit Viktoriia zu arbeiten ist ein Vergnügen, und die Fotos sind großartig geworden.",
      es: "¡Fue una experiencia maravillosa! Recomiendo muchísimo esta sesión de fotos en Lisboa — trabajar con Viktoriia es un placer y las fotos quedaron geniales.",
      fr: "Ce fut une merveilleuse expérience ! Je recommande vivement cette séance photo à Lisbonne — c'est un plaisir de travailler avec Viktoriia et les photos sont superbes.",
    },
  },
];

const client = new Client({
  user: "photoportugal",
  password: "PhotoPortugal2026Secure",
  host: "localhost",
  database: "photoportugal",
  port: 5432,
});

await client.connect();

for (const r of REV) {
  const cols = [];
  const params = [];
  for (const loc of ["pt", "de", "es", "fr"]) {
    if (r.title?.[loc] !== undefined) {
      cols.push(`title_${loc} = $${params.length + 1}`);
      params.push(r.title[loc] || null);
    }
    if (r.text?.[loc] !== undefined) {
      cols.push(`text_${loc} = $${params.length + 1}`);
      params.push(r.text[loc] || null);
    }
  }
  cols.push(`translations_dirty = FALSE`);
  params.push(r.id);
  await client.query(
    `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${params.length}`,
    params
  );
  console.log(`✓ ${r.id.slice(0, 8)}`);
}

await client.end();
console.log(`\nBatch rev-4 done — ${REV.length} reviews translated.`);
