// Reviews batch 5 — next 60 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "044350ef-87a2-4bd8-a8c2-d4591e8384a7",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendamos vivamente o trabalho do Sr. José Santos — é um excelente profissional! Atento a cada detalhe, capta os momentos mais únicos e especiais durante a sessão, deixa-nos completamente à vontade e faz com que tudo flua de forma muito natural. Contratámo-lo como fotógrafo do nosso casamento e, só pelo resultado da sessão de noivado, já mal podemos esperar pelo grande dia! Mantenha essa simpatia enquanto pessoa, e que o seu trabalho continue a crescer e a evoluir.",
      de: "Wir empfehlen die Arbeit von Herrn José Santos sehr — er ist ein ausgezeichneter Profi! Mit Liebe zu jedem Detail fängt er beim Shooting die einzigartigsten und besondersten Momente ein, lässt einen vollkommen entspannen und sorgt dafür, dass alles ganz natürlich verläuft. Wir haben ihn als Fotografen für unsere Hochzeit gebucht, und schon nach dem Ergebnis unseres Verlobungsshootings können wir den großen Tag kaum erwarten! Bleiben Sie genauso herzlich, und möge Ihre Arbeit weiter wachsen und sich entwickeln.",
      es: "Recomendamos muchísimo el trabajo del Sr. José Santos — ¡es un excelente profesional! Atento a cada detalle, capta los momentos más únicos y especiales durante la sesión, te pone completamente cómoda y hace que todo fluya de forma muy natural. Lo contratamos como fotógrafo de nuestra boda y, solo por el resultado de la sesión de pedida, ¡no podemos esperar al gran día! Conserve esa cercanía como persona, y que su trabajo siga creciendo y evolucionando.",
      fr: "Nous recommandons vivement le travail de M. José Santos — c'est un excellent professionnel ! Attentif au moindre détail, il capture les moments les plus uniques et spéciaux pendant la séance, nous met complètement à l'aise et fait en sorte que tout se déroule naturellement. Nous l'avons engagé comme photographe pour notre mariage et, rien qu'en voyant le résultat de notre séance de fiançailles, nous avons hâte d'être au grand jour ! Gardez cette même chaleur humaine, et que votre travail continue à grandir et à évoluer.",
    },
  },
  {
    id: "6e002761-b82e-4856-b610-f5e5c9b4b2ee",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Aprecio muito o profissionalismo e o cuidado do fotógrafo José Santos. As fotos do meu menino ficaram incríveis! Cada plano captou a personalidade dele na perfeição.",
      de: "Ich schätze die Professionalität und Fürsorge des Fotografen José Santos sehr. Die Fotos von meinem kleinen Jungen sind unglaublich geworden! Jede Aufnahme hat seine Persönlichkeit perfekt eingefangen.",
      es: "Aprecio muchísimo la profesionalidad y el cuidado del fotógrafo José Santos. ¡Las fotos de mi peque quedaron increíbles! Cada toma captó su personalidad a la perfección.",
      fr: "J'apprécie énormément le professionnalisme et l'attention du photographe José Santos. Les photos de mon petit garçon sont incroyables ! Chaque cliché a parfaitement capturé sa personnalité.",
    },
  },
  {
    id: "1c5cb111-6e23-4f3e-9619-8ea225f75e89",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Massimo foi fantástico a comunicar, coordenar e executar o meu pedido de casamento surpresa ao meu (agora) noivo!\nComeçámos a coordenar tudo um mês antes do pedido planeado e ele recomendou e mostrou-me locais exatos a considerar — acabei por escolher uma localização deslumbrante graças a ele.\nNo dia, fez um trabalho excelente a misturar-se com o cenário como turista e estava na posição certa para captar muitos momentos épicos do meu pedido.\nLevou-nos depois até à praia para uma pequena sessão fotográfica — foi super descontraído, divertido e brincalhão, divertimo-nos imenso!\nPor fim, entregou as fotos super depressa (1-2 semanas) e estamos muito felizes com o resultado final.\nRecomendo vivamente o Massimo se quiseres uma experiência de fotógrafo secreto de primeira classe!",
      de: "Massimo war fantastisch in der Kommunikation, Koordination und Umsetzung meines Überraschungsantrags an meinen jetzigen Verlobten!\nWir haben einen Monat vor dem geplanten Antrag begonnen, alles zu koordinieren — er hat genaue Orte vorgeschlagen und gezeigt, an denen ich den Antrag machen könnte, und ich habe dank ihm einen wunderschönen Spot ausgewählt.\nAm Tag des Antrags hat er sich großartig wie ein Tourist im Hintergrund eingefügt und war in der richtigen Position, um viele großartige Momente meines Antrags festzuhalten.\nDanach hat er uns an den Strand für ein inszeniertes Shooting gebracht, das aber super entspannt, spielerisch und lustig war — wir hatten beide eine fantastische Zeit!\nUnd schließlich hat er die Fotos super schnell geliefert (1–2 Wochen), und wir sind mit dem Endergebnis sehr glücklich.\nIch empfehle Massimo wärmstens, wenn ihr eine erstklassige Erfahrung mit einem geheimen Fotografen wollt!",
      es: "¡Massimo fue fantástico comunicando, coordinando y ejecutando mi propuesta de matrimonio sorpresa a mi (ahora) prometido!\nEmpezamos a coordinar todo un mes antes de la propuesta y me recomendó y mostró exactamente los lugares que podía considerar; al final elegí una ubicación impresionante gracias a él.\nEl día de la propuesta, hizo un gran trabajo mezclándose con el entorno como un turista más, y estaba en la posición justa para captar muchos momentos épicos de la pedida.\nLuego nos llevó a la playa para una pequeña sesión, pero fue súper relajada, divertida y juguetona — ¡los dos lo pasamos genial!\nPor último, entregó las fotos súper rápido (1-2 semanas) y estamos muy felices con el resultado final.\n¡Recomiendo muchísimo a Massimo si quieres una experiencia de fotógrafo secreto de primera!",
      fr: "Massimo a été fantastique dans la communication, la coordination et l'exécution de ma demande en mariage surprise à mon (désormais) fiancé !\nNous avons commencé à coordonner un mois avant la demande prévue, et il m'a recommandé et montré des endroits précis que je pouvais envisager pour la demande — j'ai finalement choisi un lieu magnifique grâce à lui.\nLe jour de la demande, il a fait un super travail en se fondant dans le décor comme un touriste, et il était au bon endroit pour capturer plein de moments épiques de ma demande.\nIl nous a ensuite emmenés à la plage pour une petite séance, mais c'était super détendu, ludique et amusant — nous avons tous les deux passé un excellent moment !\nEnfin, il a livré les photos super rapidement (1 à 2 semaines), et nous sommes très heureux du résultat final.\nJe recommande vivement Massimo si vous voulez une expérience de photographe secret haut de gamme !",
    },
  },
  {
    id: "565caf5b-a2ec-4954-81c0-bb8eb60a20f5",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Obrigada, Massimo! Aprecio mesmo o quão rápido a responder e dedicado estiveste! Tenho a certeza de que vamos querer comprar mais prints de surf no futuro. 🙌🏼 …",
      de: "Danke, Massimo! Ich weiß es wirklich zu schätzen, wie schnell und engagiert du warst! Ich bin sicher, dass wir in Zukunft noch mehr Surf-Prints kaufen werden. 🙌🏼 …",
      es: "¡Gracias, Massimo! Aprecio muchísimo lo rápido que respondías y lo implicado que estabas. Seguro que en el futuro querremos comprar más prints de surf. 🙌🏼 …",
      fr: "Merci, Massimo ! J'apprécie vraiment ta réactivité et ton implication ! Je suis sûre qu'on voudra acheter d'autres tirages de surf à l'avenir. 🙌🏼 …",
    },
  },
  {
    id: "2c875ff2-59ce-4bfc-944f-261e870d1141",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Marquei uma sessão de pedido de casamento surpresa e adorámos o resultado! O Massimo é mesmo profissional e uma pessoa muito simpática! Não hesites em contratá-lo!",
      de: "Ich habe ein Überraschungs-Verlobungsshooting gebucht, und das Ergebnis hat uns absolut begeistert! Massimo ist wirklich ein Profi und ein sehr netter Mensch! Zögert nicht, ihn zu buchen!",
      es: "Reservé una sesión de pedida sorpresa y nos encantó el resultado! Massimo es muy profesional y una persona muy maja! No dudes en contratarlo!",
      fr: "J'ai réservé une séance demande en mariage surprise et nous avons adoré le résultat ! Massimo est très professionnel et vraiment quelqu'un de sympa ! N'hésitez pas à le réserver !",
    },
  },
  {
    id: "337e61c5-b1dd-4708-b7af-a471374d996a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tivemos o prazer de ter o Massimo como fotógrafo da nossa sessão de noivado. Coordenou tudo com o meu noivo nos dias que antecederam a viagem. O Massimo sugeriu o sítio e a hora perfeitos para as fotos.\nFoi uma surpresa total para mim, por isso o Massimo estava escondido e conseguiu captar os momentos genuínos do pedido. Depois fizemos uma pequena sessão fotográfica, que foi muito divertida. Algumas ideias eram engraçadas no momento, mas as fotos ficaram INCRÍVEIS. De todas as fotos que pudemos escolher, não havia uma única má — estavam todas entre o ótimo e o incrível. Muito obrigada por esta experiência espetacular!",
      de: "Wir hatten das Vergnügen, Massimo als Fotografen unseres Verlobungsshootings zu haben. Er hat alles im Vorfeld unserer Reise mit meinem Verlobten abgestimmt. Massimo hat den perfekten Ort und die perfekte Uhrzeit für die Fotos vorgeschlagen.\nFür mich war es eine totale Überraschung, also hat sich Massimo versteckt und konnte die echten Momente des Antrags festhalten. Danach haben wir noch ein kleines Shooting gemacht, das viel Spaß gemacht hat. Einige Ideen waren im Moment lustig, aber die Fotos sind UNGLAUBLICH geworden. Von allen Bildern, aus denen wir auswählen konnten, gab es kein einziges schlechtes — sie reichten von „großartig\" bis „unglaublich\". Vielen Dank für die fantastische Erfahrung!",
      es: "Tuvimos el placer de contar con Massimo como fotógrafo de nuestra sesión de pedida. Coordinó todo con mi prometido en los días previos a nuestro viaje. Massimo sugirió el sitio y el momento perfectos para las fotos.\nFue una sorpresa total para mí, así que Massimo estaba escondido y luego pudo captar los momentos genuinos de la pedida. Después hicimos una pequeña sesión, que fue muy divertida. Algunas ideas resultaban graciosas en el momento, pero las fotos quedaron INCREÍBLES. De todas las fotos entre las que pudimos elegir, no había ni una mala — iban de geniales a increíbles. ¡Muchísimas gracias por la experiencia tan increíble!",
      fr: "Nous avons eu le plaisir d'avoir Massimo comme photographe pour notre séance de fiançailles. Il a tout coordonné avec mon fiancé dans les jours précédant notre voyage. Massimo a suggéré le lieu et le timing parfaits pour les photos.\nC'était une surprise totale pour moi, donc Massimo était caché et a pu capturer les moments authentiques de la demande. Nous avons ensuite fait une petite séance photo, qui a été très amusante. Certaines idées étaient drôles sur le moment, mais les photos sont INCROYABLES. Sur toutes les photos parmi lesquelles nous avons pu choisir, il n'y en avait pas une seule mauvaise — elles allaient de superbes à incroyables. Merci infiniment pour cette expérience géniale !",
    },
  },
  {
    id: "7dd21aee-4116-43f4-9e4f-c0d763fa4df0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi um prazer trabalhar com ele — ótimo com crianças, muito fácil de comunicar e extremamente profissional. Apreciámos o quão prestável e honesto foi após um pequeno mal-entendido, o que, na verdade, o tornou ainda mais simpático.\nO trabalho dele é mesmo incrível, e adorámos como a sessão foi leve, rápida e natural! Recomendo vivamente.",
      de: "Es war eine Freude, mit ihm zu arbeiten — toll mit Kindern, sehr unkompliziert in der Kommunikation und extrem professionell. Wir haben sehr geschätzt, wie hilfsbereit und ehrlich er nach einem kleinen Missverständnis war, was ihn sogar noch sympathischer gemacht hat.\nSeine Arbeit ist wirklich großartig, und uns hat gefallen, wie leicht, schnell und natürlich sich das Shooting angefühlt hat! Sehr zu empfehlen.",
      es: "Fue un placer trabajar con él — genial con los niños, muy fácil de comunicar y extremadamente profesional. Apreciamos lo atento y honesto que fue tras un pequeño malentendido, lo que en realidad lo hizo aún más simpático.\nSu trabajo es de verdad increíble, y nos encantó lo ligera, rápida y natural que se sintió la sesión. Lo recomiendo muchísimo.",
      fr: "Quel plaisir de travailler avec lui — super avec les enfants, très facile à contacter et extrêmement professionnel. Nous avons apprécié son côté serviable et honnête après un petit malentendu, ce qui l'a rendu encore plus sympathique.\nSon travail est vraiment incroyable, et nous avons adoré la légèreté, la rapidité et le naturel de la séance ! Je recommande vivement.",
    },
  },
  {
    id: "f52fc195-ef15-437a-aa2d-588321de373f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Massimo é uma pessoa maravilhosa. Desde o momento em que o contactei, foi incrivelmente atento e recomendou o melhor sítio para eu pedir a minha namorada em casamento! As fotos ficaram espetaculares! E esteve sempre em contacto comigo! Muito obrigado! Escolher o Massimo foi a melhor decisão!",
      de: "Massimo ist ein wundervoller Mensch. Von dem Moment an, als ich ihn kontaktiert habe, war er unglaublich aufmerksam und hat mir den besten Ort empfohlen, um meiner Freundin den Ring zu geben! Die Fotos sind spektakulär geworden! Und er hat sich ständig bei mir gemeldet! Vielen Dank! Massimo zu wählen war die beste Entscheidung!",
      es: "Massimo es una persona maravillosa. Desde el momento en que lo contacté, fue increíblemente atento y me recomendó el mejor sitio para entregarle el anillo a mi pareja. ¡Las fotos quedaron espectaculares! ¡Y siempre estuvo en contacto conmigo! ¡Muchísimas gracias! Elegir a Massimo fue la mejor decisión.",
      fr: "Massimo est une personne merveilleuse. Dès le moment où je l'ai contacté, il a été incroyablement attentionné et m'a recommandé le meilleur endroit pour offrir la bague à ma copine ! Les photos sont spectaculaires ! Et il a toujours gardé le contact avec moi ! Merci beaucoup ! Choisir Massimo a été la meilleure décision !",
    },
  },
  {
    id: "aaf013e3-24a0-4bbf-bb75-cc1610311970",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tours incríveis, com belas fotos e ótimos sítios nesta ilha maravilhosa. O André é um fotógrafo fantástico e conhece bem a ilha. Recomendo vivamente.",
      de: "Großartige Touren mit schönen Aufnahmen und tollen Spots auf dieser wunderschönen Insel. André ist ein hervorragender Fotograf und kennt die Insel sehr gut. Sehr zu empfehlen.",
      es: "Tours increíbles, con preciosas fotos y muy buenos rincones de esta maravillosa isla. André es un fotógrafo fantástico y conoce muy bien la isla. Muy recomendable.",
      fr: "Des tours incroyables, avec de belles photos et de superbes spots sur cette magnifique île. André est un photographe fantastique et connaît très bien l'île. Vivement recommandé.",
    },
  },
  {
    id: "a0a0bcfe-2aec-4be0-8fe6-6499b10c3ad2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Contratámos a equipa do Rui Veloso para fotografar o nosso grande dia e foi uma das melhores escolhas que fizemos! Recomendamos vivamente o Rui Veloso e a sua equipa!\n\nO Rui e a equipa foram excelentes, desde a sessão de noivado ao próprio dia do casamento, e no apoio antes, durante e depois.\n\nNa sessão de noivado, o Rui fez-nos sentir confortáveis, o que foi super importante para nós, porque não estamos habituados a ser fotografados. Tudo correu muito bem e a sessão ficou linda.\n\nNo dia do casamento, o Rui e a Ana acompanharam-nos desde os preparativos até ao copo de água. Deixaram toda a gente super à vontade, tirando fotos naturais, sem ser invasivo, exatamente como tínhamos pedido. A sessão de casal foi muito natural e divertida. As fotos ficaram incríveis, muito melhores do que tínhamos imaginado.\n\nNão podíamos recomendar mais a equipa do Rui Veloso — não te vais arrepender! ❤️",
      de: "Wir haben das Team von Rui Veloso engagiert, um unseren großen Tag festzuhalten — und es war eine der besten Entscheidungen, die wir getroffen haben! Wir empfehlen Rui Veloso und sein Team uneingeschränkt!\n\nRui und sein Team waren ausgezeichnet, von der Verlobungssession bis zum Hochzeitstag und in der Begleitung davor, während und danach.\n\nBeim Verlobungsshooting hat Rui dafür gesorgt, dass wir uns wohlfühlen — das war für uns super wichtig, weil wir nicht daran gewöhnt sind, fotografiert zu werden. Alles ist sehr gut verlaufen, und die Session ist wunderschön geworden.\n\nAm Hochzeitstag haben Rui und Ana uns von den Vorbereitungen bis zur Feier begleitet. Sie haben alle absolut entspannt sein lassen, natürliche Fotos gemacht, ohne aufdringlich zu sein — genau so, wie wir es uns gewünscht hatten. Die Paar-Session war sehr natürlich und lustig. Die Fotos sind unglaublich geworden, viel schöner, als wir es uns vorgestellt hatten.\n\nWir können das Team von Rui Veloso nicht genug empfehlen, ihr werdet es nicht bereuen! ❤️",
      es: "¡Contratamos al equipo de Rui Veloso para fotografiar nuestro gran día y fue una de las mejores decisiones que tomamos! ¡Recomendamos muchísimo a Rui Veloso y a su equipo!\n\nRui y su equipo fueron excelentes, desde la sesión de pedida hasta el día de la boda, y en el acompañamiento antes, durante y después.\n\nEn la sesión de pedida Rui nos hizo sentir cómodos, lo que para nosotros fue clave, porque no estamos acostumbrados a que nos hagan fotos. Todo fue muy bien y la sesión quedó preciosa.\n\nEl día de la boda, Rui y Ana nos acompañaron desde los preparativos hasta el banquete. Hicieron que todo el mundo se sintiera súper cómodo, sacaron fotos naturales sin ser invasivos, justo como les habíamos pedido. La sesión de pareja fue muy natural y divertida. Las fotos quedaron increíbles, mucho mejores de lo que habíamos imaginado.\n\nNo podríamos recomendar más al equipo de Rui Veloso — ¡no te arrepentirás! ❤️",
      fr: "Nous avons engagé l'équipe de Rui Veloso pour photographier notre grand jour, et c'était l'un de nos meilleurs choix ! Nous recommandons vivement Rui Veloso et son équipe !\n\nRui et son équipe ont été excellents, de la séance de fiançailles au jour du mariage, ainsi que dans l'accompagnement avant, pendant et après.\n\nPendant la séance de fiançailles, Rui nous a mis à l'aise, ce qui était super important pour nous, car nous n'avons pas l'habitude d'être photographiés. Tout s'est très bien passé et la séance est magnifique.\n\nLe jour du mariage, Rui et Ana nous ont accompagnés des préparatifs à la réception. Ils ont mis tout le monde super à l'aise, en prenant des photos naturelles sans être intrusifs, exactement comme nous l'avions demandé. La séance de couple a été très naturelle et amusante. Les photos sont incroyables, bien plus belles que ce que nous imaginions.\n\nNous ne pouvons que recommander chaleureusement l'équipe de Rui Veloso, vous ne le regretterez pas ! ❤️",
    },
  },
  {
    id: "78ba05b2-f7ab-4c6f-bb2a-75b8df696503",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui Veloso é o nosso fotógrafo oficial; já fotografou os momentos mais importantes da nossa família: o casamento, a gravidez e o batizado! Adoramos o seu trabalho e profissionalismo.",
      de: "Rui Veloso ist unser offizieller Fotograf; er hat bereits die wichtigsten Momente unserer Familie festgehalten: unsere Hochzeit, die Schwangerschaft und die Taufe! Wir lieben seine Arbeit und Professionalität.",
      es: "Rui Veloso es nuestro fotógrafo oficial; ¡ya ha fotografiado los momentos más importantes de nuestra familia: nuestra boda, el embarazo y el bautizo! Nos encanta su trabajo y profesionalidad.",
      fr: "Rui Veloso est notre photographe officiel ; il a déjà photographié les moments les plus importants de notre famille : notre mariage, la grossesse et le baptême ! Nous adorons son travail et son professionnalisme.",
    },
  },
  {
    id: "a40983ed-8a6e-4c14-a9ea-4629a7dc8edc",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Lindas, Ola! Uma recordação maravilhosa — muito obrigada 💚🧡❤️",
      de: "Wunderschön, Ola! Eine fantastische Erinnerung — vielen Dank 💚🧡❤️",
      es: "¡Preciosas, Ola! Un recuerdo maravilloso — muchísimas gracias 💚🧡❤️",
      fr: "Magnifiques, Ola ! Un souvenir merveilleux — merci beaucoup 💚🧡❤️",
    },
  },
  {
    id: "f9843a3d-644b-4dc0-96c6-6245fee3c0ae",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma sessão fotográfica linda com a Sophie à beira-mar, durante a luz do início da manhã — e foi absolutamente mágica!\nDesde o início, senti-me completamente à vontade e descontraída. A Sophie tem uma forma maravilhosa de criar uma atmosfera relaxada onde podes ser tu mesma. Entrámos rapidamente num fluxo criativo juntas e isso notou-se ao longo da sessão.\nA experiência foi profissional, inspiradora e cheia de energia positiva — e os resultados são simplesmente deslumbrantes.\nVoltaria a fazê-lo num instante e recomendo a Sophie de coração a toda a gente!",
      de: "Ich hatte ein wunderschönes Fotoshooting mit Sophie am Meer im frühen Morgenlicht — und es war absolut magisch!\nVon Anfang an habe ich mich völlig wohl und entspannt gefühlt. Sophie hat eine wundervolle Art, eine entspannte Atmosphäre zu schaffen, in der man einfach man selbst sein kann. Wir sind schnell in einen gemeinsamen kreativen Flow gekommen, und das hat man im gesamten Shooting gesehen.\nDas ganze Erlebnis war professionell, inspirierend und voller positiver Energie — und die Ergebnisse sind einfach atemberaubend.\nIch würde es jederzeit sofort wiederholen und kann Sophie von Herzen empfehlen!",
      es: "Tuve una sesión preciosa con Sophie a la orilla del mar, con la luz de primera hora de la mañana — ¡y fue absolutamente mágica!\nDesde el primer momento me sentí completamente cómoda y relajada. Sophie tiene una forma maravillosa de crear un ambiente tranquilo en el que puedes ser tú misma. Entramos enseguida en un flujo creativo juntas y se notó durante toda la sesión.\nLa experiencia fue profesional, inspiradora y llena de energía positiva — y los resultados son simplemente impresionantes.\n¡Volvería a hacerlo sin dudarlo y recomiendo a Sophie de corazón a todo el mundo!",
      fr: "J'ai fait une magnifique séance photo avec Sophie au bord de la mer, dans la lumière du petit matin — et c'était absolument magique !\nDès le début, je me suis sentie totalement à l'aise et détendue. Sophie a une merveilleuse manière de créer une atmosphère relaxante où l'on peut simplement être soi-même. Nous sommes rapidement entrées dans un flow créatif ensemble, et cela s'est ressenti tout au long de la séance.\nToute l'expérience a été professionnelle, inspirante et pleine d'énergie positive — et les résultats sont tout simplement magnifiques.\nJe le referais sans hésiter et je recommande Sophie de tout cœur à tout le monde !",
    },
  },
  {
    id: "8f67bab1-38e3-47f3-bc91-4140ab4898ce",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos a sessão fotográfica com o Denis em Lisboa, a semana passada. Marcámos uma hora e queríamos boas fotos da nossa estadia na cidade, ao mesmo tempo que eternizávamos o meu sexto mês de gravidez. O Denis é um fotógrafo experiente, com um olhar excelente para captar o momento certo. No final enviou-nos imensas fotos, e estão todas lindas! Recomendo vivamente a quem visite Lisboa vindo de França, da Bélgica…",
      de: "Wir haben das Foto-Shooting mit Denis in Lissabon letzte Woche sehr genossen. Wir hatten eine Stunde gebucht und wollten schöne Fotos von unserem Aufenthalt in der Stadt, während wir gleichzeitig meinen 6. Schwangerschaftsmonat verewigen. Denis ist ein erfahrener Fotograf mit einem tollen Auge für den richtigen Moment. Am Ende hat er uns viele Fotos geschickt — und sie sind alle wunderschön! Ich kann ihn allen empfehlen, die aus Frankreich, Belgien… nach Lissabon kommen.",
      es: "Nos encantó la sesión con Denis en Lisboa la semana pasada. Reservamos una hora y queríamos fotos bonitas de nuestra estancia en la ciudad mientras inmortalizábamos mi sexto mes de embarazo. Denis es un fotógrafo con experiencia y un ojo magnífico para captar el momento. Al final nos envió muchísimas fotos ¡y son todas preciosas! No puedo recomendarlo más a cualquiera que visite Lisboa desde Francia, Bélgica...",
      fr: "Nous avons beaucoup aimé la séance photo avec Denis à Lisbonne la semaine dernière. Nous avions réservé une heure et nous voulions de jolies photos de notre séjour en ville tout en immortalisant mon 6e mois de grossesse. Denis est un photographe expérimenté avec un excellent œil pour saisir le bon instant. À la fin, il nous a envoyé énormément de photos et elles sont toutes magnifiques ! Je le recommande vivement à toute personne visitant Lisbonne depuis la France, la Belgique…",
    },
  },
  {
    id: "abd27583-45d2-44de-b1a0-d707d68a05ae",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendamos vivamente o Denis Erroyaux! Fotografou o nosso casamento sozinho, num dia de chuva, e ainda assim conseguiu fazer com que as fotos ficassem perfeitas — um verdadeiro ninja! Para além disso, é, sem dúvida, uma excelente pessoa, com quem acabámos por desenvolver uma relação pessoal :)",
      de: "Wir empfehlen Denis Erroyaux uneingeschränkt! Er hat unsere Hochzeit allein fotografiert, an einem regnerischen Tag, und es trotzdem geschafft, dass die Fotos perfekt geworden sind — ein echter Ninja! Obendrein ist er ohne Zweifel ein wunderbarer Mensch, mit dem wir am Ende sogar eine persönliche Beziehung aufgebaut haben :)",
      es: "¡Recomendamos muchísimo a Denis Erroyaux! Fotografió nuestra boda él solo, en un día lluvioso, y aun así consiguió que las fotos quedaran perfectas — ¡un auténtico ninja! Además, sin duda es una persona excelente, con la que acabamos forjando una relación personal :)",
      fr: "Nous recommandons vivement Denis Erroyaux ! Il a photographié notre mariage seul, un jour de pluie, et a tout de même réussi à rendre les photos parfaites — un vrai ninja ! En plus, c'est sans aucun doute une excellente personne, avec qui nous avons fini par tisser un lien personnel :)",
    },
  },
  {
    id: "23c484e1-1224-4552-bb58-d4ff9619d9b2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O batizado do nosso filho foi fotografado pela Isa, uma excelente pessoa, cheia de boa disposição e muito gentil. Fez-nos sentir muito à vontade, a nós e ao nosso filho. Nem sempre é fácil fotografar crianças, mas as fotos ficaram maravilhosas. A paciência com o nosso bebé e a sua boa disposição foram incríveis. Recomendo o seu trabalho e agradeço-lhe do fundo do coração por captar os momentos do batizado do nosso bebé.",
      de: "Die Taufe unseres Sohnes wurde von Isa fotografiert — ein wunderbarer Mensch, voller guter Laune und sehr herzlich. Sie hat sowohl uns als auch unseren Sohn ganz entspannt sein lassen. Kinder zu fotografieren ist nicht immer einfach, aber die Bilder sind wunderschön geworden. Ihre Geduld mit unserem Baby und ihre gute Laune waren unglaublich. Ich empfehle ihre Arbeit und danke ihr von Herzen, dass sie die Momente der Taufe unseres Babys eingefangen hat.",
      es: "El bautizo de nuestro hijo lo fotografió Isa, una persona excelente, llena de buen humor y muy amable. Nos hizo sentir muy cómodos, a nosotros y a nuestro hijo. No siempre es fácil fotografiar a niños, pero las fotos quedaron maravillosas. Su paciencia con nuestro bebé y su buen humor fueron increíbles. Recomiendo su trabajo y le agradezco de corazón haber captado los momentos del bautizo de nuestro bebé.",
      fr: "Le baptême de notre fils a été photographié par Isa, une excellente personne, pleine de bonne humeur et très gentille. Elle nous a mis très à l'aise, nous et notre fils. Photographier des enfants n'est pas toujours facile, mais les photos sont magnifiques. Sa patience avec notre bébé et sa bonne humeur ont été incroyables. Je recommande son travail et je la remercie du fond du cœur d'avoir capturé les moments du baptême de notre bébé.",
    },
  },
  {
    id: "eb504bbc-12c7-4d9f-88fd-0cd5262a4b01",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A simpatia e o profissionalismo tornaram esta sessão uma experiência tranquila e agradável, criando memórias que vamos guardar para sempre! Adorámos!",
      de: "Freundlichkeit und Professionalität haben dieses Shooting zu einem entspannten und angenehmen Erlebnis gemacht — wir haben Erinnerungen geschaffen, die wir für immer bewahren werden! Wir waren begeistert!",
      es: "¡La amabilidad y la profesionalidad hicieron que esta sesión fuera una experiencia tranquila y agradable, creando recuerdos que guardaremos para siempre! ¡Nos encantó!",
      fr: "La gentillesse et le professionnalisme ont fait de cette séance une expérience paisible et agréable, créant des souvenirs que nous garderons à jamais ! Nous avons adoré !",
    },
  },
  {
    id: "f1e6cf29-2818-4df1-9ee7-60b17a783a5b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Excelente profissional. Muito acessível. Ótimas fotos 😊",
      de: "Hervorragender Profi. Sehr unkompliziert im Umgang. Tolle Fotos 😊",
      es: "Excelente profesional. Muy cercano. Fotos geniales 😊",
      fr: "Excellent professionnel. Très accessible. De superbes photos 😊",
    },
  },
  {
    id: "49ba5ae9-7584-4d5a-a988-33163c3afd29",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Por onde começar? :) A Vika é uma fotógrafa absolutamente incrível, com um talento enorme — são as melhores fotos que já tive de mim. O que ela é capaz de fazer em 30 minutos é fantástico, por isso, não hesites em contactá-la. Adoro-as e obrigada outra vez, Vika, por toda a magia que crias com a tua câmara!",
      de: "Wo soll ich anfangen? :) Vika ist eine absolut unglaubliche Fotografin mit so viel Talent — das sind die besten Fotos, die ich je von mir hatte. Was sie in 30 Minuten zu schaffen vermag, ist fantastisch — also zögert nicht, sie zu kontaktieren. Ich liebe sie und danke dir, Vika, noch einmal für all die Magie, die du mit deiner Kamera erschaffst!",
      es: "¿Por dónde empezar? :) Vika es una fotógrafa absolutamente increíble, con muchísimo talento — son las mejores fotos que he tenido de mí. Lo que es capaz de hacer en 30 minutos es fantástico, así que no dudes en contactar con ella. Las adoro y mil gracias otra vez, Vika, por toda la magia que haces con tu cámara!",
      fr: "Par où commencer ? :) Vika est une photographe absolument incroyable, avec un immense talent — ce sont les meilleures photos que j'aie jamais eues de moi. Ce qu'elle est capable de faire en 30 minutes est fantastique, alors n'hésitez pas à la contacter. Je les adore et merci encore, Vika, pour toute la magie que tu fais avec ton appareil !",
    },
  },
  {
    id: "84502901-834c-4e51-9f8b-a056068e1c7f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Muito obrigada, Cindy, estamos super, super, super felizes com as fotos. Os nossos miúdos adoraram brincar na praia durante a sessão e as fotos são tão \"a nossa cara\" por causa disso. Vamos de certeza voltar a marcar contigo no próximo ano!",
      de: "Vielen lieben Dank, Cindy, wir sind so, so, so glücklich mit unseren Fotos. Unsere Kinder haben es geliebt, während des Shootings am Strand zu spielen, und genau deshalb sind die Bilder so „typisch wir\". Wir buchen dich nächstes Jahr ganz sicher wieder!",
      es: "Muchísimas gracias, Cindy, estamos super, super, super contentos con las fotos. A nuestros peques les encantó jugar en la playa durante la sesión y las fotos son tan \"nosotros\" gracias a eso. ¡Sin duda volveremos a reservar contigo el año que viene!",
      fr: "Merci beaucoup, Cindy, nous sommes vraiment, vraiment, vraiment ravis de nos photos. Nos enfants ont adoré jouer sur la plage pendant la séance et les photos nous \"ressemblent\" tellement grâce à cela. Nous te rebookerons sans aucun doute l'année prochaine !",
    },
  },
  {
    id: "4d0fcd82-9108-4622-b8b7-f5c542912807",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei o trabalho que fez, desde o primeiro momento até às fotos finais, que, na minha opinião, ficaram lindíssimas — um resultado que compensa, e bem, o investimento. Recomendo vivamente a quem procurar este tipo de trabalho — não vai sair desiludido. Obrigada pelo empenho!",
      de: "Ich habe seine Arbeit sehr genossen, vom ersten Moment bis zu den finalen Fotos, die meiner Meinung nach wunderschön geworden sind — ein Ergebnis, das den Preis mehr als wert ist. Ich empfehle ihn allen, die so eine Arbeit suchen, ihr werdet nicht enttäuscht sein. Danke für den Einsatz!",
      es: "Me encantó el trabajo que hizo, desde el primer momento hasta las fotos finales, que en mi opinión quedaron preciosas — un resultado que compensa, y mucho, el coste. Lo recomiendo muchísimo a quien busque este tipo de trabajo, no te decepcionará. ¡Gracias por la dedicación!",
      fr: "J'ai vraiment adoré son travail, du premier instant jusqu'aux photos finales qui, à mon avis, sont magnifiques — un résultat qui vaut largement son coût. Je le recommande vivement à toute personne cherchant ce type de prestation, vous ne serez pas déçu. Merci pour votre engagement !",
    },
  },
  {
    id: "fce18f88-d991-4954-8820-aea88c637150",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Um excelente fotógrafo! Recomendo vivamente. Pela minha experiência, é super prestável e de confiança. Não percas a oportunidade de transformar a tua história de vida em pequenos retratos — daqui a uns anos é tão bom olhar para trás e ver como éramos. Estou muito grata por ter este fotógrafo como parte do meu caminho. Vai em frente!",
      de: "Ein großartiger Fotograf! Sehr zu empfehlen. Aus meiner Erfahrung ist er super hilfsbereit und vertrauenswürdig. Verpasse nicht die Gelegenheit, deine Lebensgeschichte in kleinen Porträts festzuhalten — Jahre später ist es so schön, zurückzublicken und zu sehen, wie wir waren. Ich bin so dankbar, dass dieser Fotograf Teil meines Weges ist. Mach es einfach!",
      es: "¡Un excelente fotógrafo! Lo recomiendo muchísimo. Por mi experiencia, es súper atento y de fiar. No pierdas la oportunidad de convertir tu historia de vida en pequeños retratos — dentro de unos años es precioso mirar atrás y ver cómo éramos. Estoy muy agradecida de tener a este fotógrafo como parte de mi camino. ¡Adelante!",
      fr: "Un super photographe ! Vivement recommandé. D'après mon expérience, il est super serviable et digne de confiance. Ne ratez pas l'occasion de transformer votre histoire de vie en petits portraits — quelques années plus tard, c'est tellement agréable de regarder en arrière et de voir comment nous étions. Je suis très reconnaissante d'avoir ce photographe sur mon chemin. Foncez !",
    },
  },
  {
    id: "6648ddfb-8583-4422-b94f-d730b3505ae8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Massimo fez um trabalho maravilhoso nas nossas fotos de cura energética para a Quantum-Touch. Estamos muito felizes com o resultado final!",
      de: "Massimo hat bei unseren Fotos zur energetischen Heilarbeit für Quantum-Touch wundervolle Arbeit geleistet. Wir sind mit dem Endergebnis sehr glücklich!",
      es: "Massimo hizo un trabajo maravilloso con nuestras fotos de sanación energética para Quantum-Touch. ¡Estamos muy contentos con el resultado final!",
      fr: "Massimo a fait un travail merveilleux sur nos photos de soin énergétique pour Quantum-Touch. Nous sommes très heureux du résultat final !",
    },
  },
  {
    id: "c90ce3e5-28c3-4957-914e-dc7ad209017a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Massimo foi mesmo o homem certo — a pessoa perfeita para captar o nosso pedido de casamento surpresa. As fotos ficaram incríveis e foi muito comunicativo de antemão para ajudar a planear a sessão. Depois da surpresa, deixou-nos muito confortáveis e fez uma pequena sessão fotográfica ótima. Recomendo vivamente.",
      de: "Massimo war wirklich der Mann — der perfekte Profi, um unsere Überraschungsverlobung einzufangen. Die Fotos sind unglaublich geworden, und er hat im Vorfeld sehr offen kommuniziert, um die Session mit zu planen. Nach der Überraschung hat er uns total entspannen lassen und ein wunderbares kleines Shooting gemacht. Sehr zu empfehlen.",
      es: "Massimo fue el hombre indicado — la persona perfecta para captar nuestra pedida sorpresa. Las fotos quedaron increíbles y se comunicó muchísimo antes para ayudar a planear la sesión. Después de la sorpresa, nos hizo sentir muy cómodos e hizo una pequeña sesión genial. Lo recomiendo muchísimo.",
      fr: "Massimo a été l'homme de la situation — la personne parfaite pour capturer notre demande surprise. Les photos sont incroyables, et il a beaucoup communiqué en amont pour aider à planifier la séance. Après la surprise, il nous a mis très à l'aise et a fait une petite séance photo géniale. Vivement recommandé.",
    },
  },
  {
    id: "0a383b62-1fd3-4b07-950e-51495a982c05",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Experiência fantástica! Muito fácil de trabalhar com ele, super flexível, e as fotos ficaram extremamente bem — qualidade muito alta. Recomendo, sem dúvida.",
      de: "Eine fantastische Erfahrung! Die Zusammenarbeit war sehr unkompliziert, super flexibel, und die Fotos sind extrem gut geworden — höchste Qualität. Sehr zu empfehlen.",
      es: "¡Experiencia fantástica! Muy fácil trabajar con él, súper flexible, y las fotos quedaron extremadamente bien — gran calidad. Sin duda lo recomiendo.",
      fr: "Une expérience fantastique ! Très facile de travailler avec lui, super flexible, et les photos sont extrêmement réussies — d'une grande qualité. Je recommande sans hésiter.",
    },
  },
  {
    id: "74894512-bdfc-4b07-afe0-71a08a960895",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Kristina é uma artista fotográfica altamente profissional, sempre disposta a experimentar estilos e ângulos. Os seus trabalhos transmitem emoções, com um aspeto quente e etéreo; um sentimento fugaz, quase nostálgico, que só pode ser sentido, e não explicado. Se queres trazer recordações ainda mais luminosas da tua estadia no Porto e juntar a exploração da cidade a uma sessão fotográfica divertida, então \"unir forças\" com a Kristina é uma oportunidade maravilhosa.",
      de: "Kristina ist eine hochprofessionelle Fotokünstlerin, die immer bereit ist, mit Stilen und Perspektiven zu experimentieren. Ihre Arbeiten transportieren Emotionen mit einer warmen, ätherischen Note; ein flüchtiges, fast nostalgisches Gefühl, das man eher erleben als erklären kann. Wenn du noch hellere Erinnerungen an deinen Aufenthalt in Porto schaffen und eine Stadterkundung mit einem lustigen Fotoshooting verbinden willst, dann sind „die Kräfte mit Kristina zu vereinen\" eine wunderbare Gelegenheit.",
      es: "Kristina es una fotoartista de un altísimo nivel profesional, siempre dispuesta a experimentar con estilos y ángulos. Sus trabajos transmiten emociones, con un toque cálido y etéreo; una sensación fugaz, casi nostálgica, que solo se puede sentir, no explicar. Si quieres llevarte recuerdos aún más luminosos de tu estancia en Oporto y combinar la exploración de la ciudad con una sesión fotográfica divertida, entonces \"unir fuerzas\" con Kristina es una oportunidad maravillosa.",
      fr: "Kristina est une photo-artiste hautement professionnelle, toujours prête à expérimenter les styles et les angles. Ses œuvres transmettent des émotions, avec un aspect chaleureux et éthéré ; un sentiment fugace, presque nostalgique, que l'on peut seulement ressentir, pas expliquer. Si vous voulez ramener des souvenirs encore plus lumineux de votre séjour à Porto et associer l'exploration de la ville à une séance photo amusante, alors « unir vos forces » avec Kristina est une magnifique opportunité.",
    },
  },
  {
    id: "393d6415-7c6c-4ca6-b094-54341b86ec49",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ola, sinceramente 🥲 estou tão emocionada — é uma recordação maravilhosa e as fotos estão tão bonitas. Estou em choque!",
      de: "Ola, ich bin ganz ehrlich 🥲 so gerührt — es ist eine wunderbare Erinnerung und die Fotos sind so schön. Ich bin sprachlos!",
      es: "Ola, en serio 🥲 estoy tan emocionada — es un recuerdo maravilloso y las fotos están preciosas. ¡Estoy en shock!",
      fr: "Ola, sincèrement 🥲 je suis tellement émue — c'est un merveilleux souvenir et les photos sont magnifiques. Je suis sous le choc !",
    },
  },
  {
    id: "090d8035-7cc0-4bf2-aa28-3fb8a2ecb06d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Wouaouw! O que te posso dizer ao primeiro olhar é que adoro-as completamente!! 🤩 Vai ser difícil escolher 😅 As da árvore 😍 — a luz está tão bonita! Exatamente o que queria transmitir: força e ternura ao mesmo tempo 🙏🏻❤️",
      de: "Wouaouw! Was ich dir nach dem ersten Blick sagen kann: Ich liebe sie absolut!! 🤩 Es wird schwer werden zu wählen 😅 Die im Baum 😍 — das Licht ist so wunderschön! Genau das, was ich ausdrücken wollte: Stärke und Zärtlichkeit zugleich 🙏🏻❤️",
      es: "¡Wouaouw! Lo que te puedo decir tras la primera mirada es que las adoro absolutamente! 🤩 Va a ser difícil elegir 😅 Las del árbol 😍 — ¡la luz está preciosa! Exactamente lo que quería transmitir: fuerza y ternura al mismo tiempo 🙏🏻❤️",
      fr: "Wouaouw ! Ce que je peux te dire après un premier regard, c'est que je les adore complètement !! 🤩 Ça va être difficile de choisir 😅 Celles dans l'arbre 😍 — la lumière est tellement belle ! Exactement ce que je voulais exprimer : force et tendresse en même temps 🙏🏻❤️",
    },
  },
  {
    id: "36e5f8c3-cc5f-4ae2-b3c7-7d6eb267fe08",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis é um fotógrafo muito simpático e talentoso! Deixou toda a gente à vontade no nosso casamento e foi discreto quando era preciso — as nossas fotos são naturais e cheias de alegria. Para além disso, enviou-nos as fotos editadas em muito pouco tempo.",
      de: "Denis ist ein sehr freundlicher und talentierter Fotograf! Er hat bei unserer Hochzeit alle entspannen lassen und konnte dezent sein, wenn es nötig war — unsere Fotos sind natürlich und voller Freude. Außerdem hat er uns die bearbeiteten Bilder in kürzester Zeit geschickt.",
      es: "¡Denis es un fotógrafo muy simpático y con muchísimo talento! Hizo que todo el mundo se sintiera cómodo en nuestra boda y supo ser discreto cuando era necesario — nuestras fotos son naturales y llenas de alegría. Además, nos envió las fotos editadas en muy poco tiempo.",
      fr: "Denis est un photographe très sympathique et talentueux ! Il a mis tout le monde à l'aise lors de notre mariage et a su être discret quand il le fallait — nos photos sont naturelles et pleines de joie. En plus, il nous a envoyé les photos retouchées en très peu de temps.",
    },
  },
  {
    id: "15768f2b-c9aa-4926-bdb2-e5d7c9ebbdd8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis tirou as nossas fotos. É excelente e capta planos que nem te ocorreriam. A qualidade das suas imagens, aliada à criatividade, é incrível. É também muito bom a deixar as pessoas à vontade, por isso não há sorrisos forçados nas fotos. Ótimo trabalho, e recebemos as fotos pouco depois do nosso evento. Toda a gente que estava presente fica linda nas fotos! Recomendamos.",
      de: "Denis hat unsere Fotos gemacht. Er ist großartig und fängt Aufnahmen ein, an die man selbst gar nicht denken würde. Die Qualität seiner Bilder in Kombination mit seiner Kreativität ist hervorragend. Er ist außerdem sehr gut darin, Menschen entspannen zu lassen, sodass es keine erzwungenen Lächeln auf den Fotos gibt. Tolle Arbeit, und wir haben unsere Fotos kurz nach dem Event bekommen. Alle, die dabei waren, sehen auf den Bildern großartig aus! Wir empfehlen ihn.",
      es: "Denis hizo nuestras fotos. Es genial y capta tomas en las que ni se te habría ocurrido pensar. La calidad de sus imágenes combinada con su creatividad es excelente. También es muy bueno poniendo cómoda a la gente, así que nada de sonrisas forzadas en las fotos. Gran trabajo, y recibimos nuestras fotos enseguida tras el evento. Todas las personas que estaban presentes salen genial en las fotos. Lo recomendamos.",
      fr: "Denis a pris nos photos. Il est génial et capture des clichés auxquels vous n'auriez même pas pensé. La qualité de ses images combinée à sa créativité est excellente. Il sait aussi très bien mettre les gens à l'aise, donc pas de sourires forcés sur les photos. Super travail, et nous avons reçu nos photos peu après notre événement. Toutes les personnes présentes sont superbes en photo ! Nous recommandons.",
    },
  },
  {
    id: "fd1eb9a6-6f4f-4949-8b3d-9757f88763b8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Denis foi-nos recomendado por um casal amigo e foi a melhor coisa que nos podia ter acontecido! É um fotógrafo extremamente profissional, super dedicado ao que faz e muito focado no sentido estético das fotografias. As imagens dele vão manter-se intemporais durante muitos anos. Recomendo vivamente!",
      de: "Denis wurde uns von einem befreundeten Paar empfohlen, und das war das Beste, was uns passieren konnte! Er ist ein extrem professioneller Fotograf, super engagiert in dem, was er tut, und sehr auf den ästhetischen Sinn der Bilder fokussiert. Seine Aufnahmen werden über viele Jahre zeitlos bleiben. Sehr zu empfehlen!",
      es: "Denis nos lo recomendó una pareja amiga y fue lo mejor que nos pudo pasar. Es un fotógrafo extremadamente profesional, súper dedicado a lo que hace, y muy enfocado en el sentido estético de las fotografías. Sus imágenes se mantendrán atemporales durante muchos años. ¡Lo recomiendo muchísimo!",
      fr: "Denis nous a été recommandé par un couple ami, et c'est la meilleure chose qui pouvait nous arriver ! C'est un photographe extrêmement professionnel, très dévoué à son métier, et très attaché au sens esthétique des photographies. Ses images resteront intemporelles pendant de nombreuses années. Vivement recommandé !",
    },
  },
  {
    id: "ee85904b-b705-4232-a3c3-1955648ba9f2",
    title: {
      pt: "A pessoa perfeita para o evento perfeito!",
      de: "Die perfekte Person für das perfekte Event!",
      es: "¡La persona perfecta para el evento perfecto!",
      fr: "La personne parfaite pour l'événement parfait !",
    },
    text: {
      pt: "A Débora foi um anjo para nós. Para além de profissional, a sua simples presença foi tudo o que precisávamos para tornar o nosso dia ainda mais especial. Recomendo a 1000%, sem dúvida.",
      de: "Débora war ein Engel für uns. Weit mehr als nur professionell — schon allein ihre Anwesenheit war alles, was wir brauchten, um unseren Hochzeitstag noch besonderer zu machen. Ich empfehle sie zu 1000 %, ohne Zweifel.",
      es: "Débora fue un ángel para nosotros. Más allá de profesional, su sola presencia fue todo lo que necesitamos para hacer que nuestro día de boda fuera aún más especial. La recomiendo al 1000%, sin duda.",
      fr: "Débora a été un ange pour nous. Plus que professionnelle, sa simple présence a été tout ce dont nous avions besoin pour rendre notre jour de mariage encore plus spécial. Je la recommande à 1000 %, sans aucun doute.",
    },
  },
  {
    id: "98c815fd-ce28-47c6-976e-c2c51eb828a3",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A sessão fotográfica foi simplesmente maravilhosa! A Isa é super simpática, atenta e fez-nos sentir completamente à vontade do início ao fim. Teve uma interação fantástica com o nosso bebé de 3 meses, sempre com muita paciência e carinho. As fotos ficaram incríveis e o seu profissionalismo fez toda a diferença. Recomendo de coração — uma experiência impecável!",
      de: "Das Fotoshooting war einfach wunderbar! Isa ist super freundlich, aufmerksam und hat uns von Anfang bis Ende vollkommen entspannen lassen. Sie hatte eine fantastische Interaktion mit unserem 3 Monate alten Baby, immer mit viel Geduld und Zuneigung. Die Fotos sind unglaublich geworden, und ihre Professionalität hat den Unterschied gemacht. Ich empfehle sie von Herzen — eine makellose Erfahrung!",
      es: "¡La sesión de fotos fue, sencillamente, maravillosa! Isa es súper simpática, atenta, y nos hizo sentir totalmente cómodos de principio a fin. Tuvo una interacción fantástica con nuestro bebé de 3 meses, siempre con mucha paciencia y cariño. Las fotos quedaron increíbles, y su profesionalidad marcó la diferencia. La recomiendo de corazón — ¡una experiencia impecable!",
      fr: "La séance photo a été tout simplement merveilleuse ! Isa est super sympathique, attentive et nous a totalement mis à l'aise du début à la fin. Elle a eu une interaction fantastique avec notre bébé de 3 mois, toujours avec beaucoup de patience et de tendresse. Les photos sont incroyables, et son professionnalisme a fait toute la différence. Je la recommande de tout cœur — une expérience impeccable !",
    },
  },
  {
    id: "00e90c8e-8c61-4639-ba6c-af7a7d903753",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Isa faz magia acontecer com as suas fotos lindas e cenários incríveis! 🤩",
      de: "Isa zaubert mit ihren wunderschönen Fotos und beeindruckenden Settings! 🤩",
      es: "¡Isa hace magia con sus preciosas fotos y escenarios increíbles! 🤩",
      fr: "Isa fait de la magie avec ses magnifiques photos et ses décors incroyables ! 🤩",
    },
  },
  {
    id: "f81a8bb9-a091-4c01-969d-910cef16ce76",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos esta experiência em Lisboa! Recomendo vivamente a quem queira ter fotos lindas enquanto está na cidade!",
      de: "Wir haben dieses Erlebnis in Lissabon geliebt! Sehr zu empfehlen für alle, die in der Stadt schöne Fotos haben möchten!",
      es: "¡Nos encantó esta experiencia en Lisboa! ¡Lo recomiendo muchísimo a quien quiera tener fotos preciosas mientras está en la ciudad!",
      fr: "Nous avons adoré cette expérience à Lisbonne ! Vivement recommandée à toute personne souhaitant avoir de magnifiques photos pendant son séjour en ville !",
    },
  },
  {
    id: "65d50c7d-edd5-4abd-910c-b37bc9e9d966",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Vika incorporou um par de ideias que tínhamos, mas foi mesmo ela que escolheu os locais e as poses, com uma grande visão artística. Sentimos que nos estava a dar fotos que nunca teríamos pensado em tirar nós mesmos. Foi a nossa primeira experiência com um fotógrafo nas férias em família, e voltaríamos a fazê-lo!",
      de: "Vika hat ein paar unserer Ideen aufgegriffen, aber die Wahl der Locations und der Posen lag wirklich bei ihr — und sie hatte einen tollen künstlerischen Blick. Wir hatten das Gefühl, Fotos zu bekommen, an die wir selbst nie gedacht hätten. Es war unsere erste Erfahrung mit einem Fotografen im Familienurlaub, und wir würden es jederzeit wieder tun!",
      es: "Vika incorporó algunas ideas que teníamos, pero realmente fue ella quien eligió los sitios y las poses, con una gran visión artística. Sentimos que de verdad nos estaba dando fotos que nunca se nos habrían ocurrido a nosotros. Fue nuestra primera experiencia con un fotógrafo en unas vacaciones familiares, ¡y volveríamos a hacerlo!",
      fr: "Vika a intégré quelques idées que nous avions, mais c'est elle qui a vraiment choisi les lieux et les poses, avec une grande vision artistique. Nous avons eu l'impression qu'elle nous offrait des photos que nous n'aurions jamais pensé à prendre nous-mêmes. C'était notre première expérience avec un photographe en vacances en famille, et nous le referions !",
    },
  },
  {
    id: "046d3d0a-9901-406f-87b2-1da3242e1f24",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "É a primeira vez que eu e a minha mulher fazemos uma sessão fotográfica e correu lindamente. A Viktoriia encontrou-se connosco num dos miradouros populares de Alfama e levou-nos pelas inúmeras ruelas calcetadas do bairro. Sabia claramente onde estavam os melhores sítios e captou várias fotos nossas com os elétricos históricos. Não somos especialistas a posar, mas as suas indicações simples e gentis ajudaram imenso, e os resultados são ótimos. Entregou as fotos numa semana, mais do que eu esperava. No geral, estamos super felizes com as nossas fotos e recomendo vivamente a Viktoriia!",
      de: "Es war das erste Mal, dass meine Frau und ich ein Fotoshooting gemacht haben, und es ist wunderbar gelaufen. Viktoriia hat uns an einem der beliebten Aussichtspunkte in der Alfama getroffen und uns durch die vielen verwinkelten Kopfsteinpflastergassen des Viertels geführt. Sie wusste eindeutig, wo die besten Spots sind, und hat viele Fotos von uns mit den historischen Straßenbahnen gemacht. Wir sind keine Profis im Posieren, aber ihre einfachen und freundlichen Anweisungen haben enorm geholfen, und die Ergebnisse sind großartig. Sie hat die Fotos innerhalb einer Woche geliefert, mehr als ich erwartet hätte. Insgesamt sind wir mit unseren Fotos super glücklich, und ich empfehle Viktoriia wärmstens!",
      es: "Es la primera vez que mi mujer y yo hacemos una sesión de fotos y salió genial. Viktoriia nos encontró en uno de los miradores más populares de Alfama y nos llevó por las muchas calles empedradas y serpenteantes del barrio. Sabía claramente dónde estaban los mejores rincones y consiguió un montón de tomas con los tranvías históricos. No somos expertos posando, pero sus indicaciones sencillas y amables ayudaron muchísimo, y los resultados son geniales. Entregó las fotos en una semana, más rápido de lo que esperaba. En general, estamos súper felices con nuestras fotos y recomiendo muchísimo a Viktoriia!",
      fr: "C'est la première fois que ma femme et moi faisons une séance photo, et elle s'est merveilleusement bien passée. Viktoriia nous a retrouvés à l'un des points de vue les plus populaires de l'Alfama et nous a emmenés à travers les nombreuses ruelles pavées du quartier. Elle savait clairement où se trouvaient les meilleurs spots et a fait beaucoup de photos avec les tramways historiques. Nous ne sommes pas experts en poses, mais ses indications simples et bienveillantes nous ont énormément aidés, et les résultats sont superbes. Elle a livré les photos en une semaine, plus rapidement que ce à quoi je m'attendais. Dans l'ensemble, nous sommes super heureux de nos photos et je recommande vivement Viktoriia !",
    },
  },
  {
    id: "c083ac87-8ba7-460b-8f5c-5a63dca04935",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Antes de mais, quero agradecer toda a tua simpatia e disponibilidade. Quanto às fotos, ficaram fantásticas. Um excelente profissional — recomendo plenamente. Obrigada!",
      de: "Zunächst einmal möchte ich mich für deine Freundlichkeit und Verfügbarkeit bedanken. Was die Fotos betrifft, sind sie fantastisch geworden. Ein hervorragender Profi — ich empfehle ihn uneingeschränkt. Vielen Dank!",
      es: "Antes de nada, quiero agradecerte toda tu amabilidad y disponibilidad. En cuanto a las fotos, quedaron fantásticas. Un excelente profesional — lo recomiendo totalmente. ¡Gracias!",
      fr: "Avant tout, je veux te remercier pour toute ta gentillesse et ta disponibilité. Quant aux photos, elles sont fantastiques. Un excellent professionnel — je le recommande totalement. Merci !",
    },
  },
  {
    id: "642a0cd8-3b96-44d6-94c8-e0eb67e22ddf",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei trabalhar com o Massimo. Embora eu tenha sido uma cliente bastante complicada (por exemplo, não sabia que cenário escolher até 3 horas antes da sessão), o Massimo manteve-se super calmo e prestável durante todo o processo. Respondia rapidamente às mensagens e era muito fiável e de confiança. Também adorei o shooting e fiquei feliz com as fotos que criámos. Recomendação total!",
      de: "Ich habe es geliebt, mit Massimo zu arbeiten. Obwohl ich eine ziemlich komplizierte Kundin war (zum Beispiel wusste ich bis 3 Stunden vor dem Shooting nicht, welche Location ich wählen soll), ist Massimo den ganzen Prozess über super entspannt und unterstützend geblieben. Er hat schnell auf Nachrichten geantwortet und war sehr zuverlässig und vertrauenswürdig. Auch das Shooting hat mir Spaß gemacht und ich bin sehr glücklich mit den Bildern, die wir gemacht haben. Volle Empfehlung!",
      es: "Me encantó trabajar con Massimo. Aunque fui una clienta bastante complicada (por ejemplo, no sabía qué escenario elegir hasta 3 horas antes de la sesión), Massimo se mantuvo súper tranquilo y servicial durante todo el proceso. Respondía rapidísimo a los mensajes y era muy fiable y de confianza. También disfruté de la sesión y estoy contenta con las fotos que creamos. ¡Recomendación total!",
      fr: "J'ai adoré travailler avec Massimo. Bien que j'aie été une cliente assez compliquée (par exemple, je n'arrivais pas à choisir le décor avant 3 heures avant la séance), Massimo est resté super zen et attentionné tout au long du processus. Il répondait rapidement aux messages et était très fiable et digne de confiance. J'ai également apprécié la séance et je suis ravie des photos que nous avons créées. Recommandation totale !",
    },
  },
  {
    id: "4bf2b32f-89a0-4f42-89ce-0e5310904c32",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não podia estar mais feliz com a forma como tudo correu. Garantiu que cada parte deste pedido de casamento corresse exatamente como planeado. Foi muito simpático e muito bom no que faz. Recomendo absolutamente.",
      de: "Ich könnte nicht zufriedener sein, wie alles gelaufen ist. Er hat dafür gesorgt, dass jeder Teil dieses Antrags genauso wie geplant verlaufen ist. Er war sehr nett und richtig gut in dem, was er tut. Absolute Empfehlung.",
      es: "No podría estar más contento con cómo salió todo. Se aseguró de que cada parte de esta pedida saliera exactamente como estaba planeada. Fue muy amable y muy bueno en lo que hace. Lo recomiendo totalmente.",
      fr: "Je ne pourrais pas être plus heureux de la façon dont tout s'est passé. Il a veillé à ce que chaque partie de cette demande se déroule exactement comme prévu. Il a été très gentil et excellent dans son travail. Je recommande absolument.",
    },
  },
  {
    id: "bb6e13e0-849f-420d-93e7-e7689ff5dc73",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adoro as fotos! Muito obrigada por isto — ficaram absolutamente lindas e captaste o ambiente exatamente como eu tinha imaginado.",
      de: "Ich liebe die Bilder! Vielen Dank dafür — sie sind absolut wunderschön geworden, und du hast die Stimmung genau so eingefangen, wie ich es mir erhofft hatte.",
      es: "¡Me encantan las fotos! Muchísimas gracias por esto — quedaron absolutamente preciosas y capturaste el ambiente justo como esperaba.",
      fr: "J'adore les photos ! Merci beaucoup pour cela — elles sont absolument magnifiques et tu as capturé l'ambiance exactement comme je l'espérais.",
    },
  },
  {
    id: "73f32b1d-1b7a-4062-b6aa-dfceacf97bc8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Olá! Obrigada pelas fotos — ficaram incríveis. Obrigada pelo profissionalismo e pela paciência… Adorámos tudo ❤️❤️❤️ Até à próxima.",
      de: "Hallo! Danke für die Fotos — sie sind unglaublich geworden. Danke für die Professionalität und die Geduld… Wir haben alles geliebt ❤️❤️❤️ Bis zum nächsten Mal.",
      es: "¡Hola! Gracias por las fotos — quedaron increíbles. Gracias por la profesionalidad y la paciencia... Nos encantó todo ❤️❤️❤️ Hasta la próxima.",
      fr: "Bonjour ! Merci pour les photos — elles sont incroyables. Merci pour le professionnalisme et la patience… Nous avons tout adoré ❤️❤️❤️ À la prochaine.",
    },
  },
  {
    id: "22b850b9-00f1-470c-89b8-ee568b2f8d05",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi o segundo ano consecutivo em que fizemos o nosso álbum de Natal em família com o Rui e, mais uma vez, tivemos uma ótima experiência. É muito simpático, profissional e atento. Está sempre disponível e atendeu a todos os nossos pedidos e preferências na conceção do álbum, sempre com tempo de resposta muito rápido. Para além disso, as fotografias estão maravilhosas. Sem dúvida uma experiência a repetir.",
      de: "Es war das zweite Jahr in Folge, in dem wir unser Familien-Weihnachtsalbum mit Rui gemacht haben, und wir hatten erneut eine großartige Erfahrung. Er ist sehr freundlich, professionell und aufmerksam. Er ist immer erreichbar und ist auf alle unsere Wünsche und Vorlieben bei der Albumgestaltung eingegangen, immer mit sehr schneller Reaktionszeit. Außerdem sind die Fotos wunderschön. Auf jeden Fall eine Erfahrung, die wir wiederholen werden.",
      es: "Fue el segundo año consecutivo en el que hicimos nuestro álbum de Navidad en familia con Rui y, una vez más, tuvimos una experiencia genial. Es muy simpático, profesional y atento. Siempre está disponible y atendió todas nuestras peticiones y preferencias en la composición del álbum, siempre con un tiempo de respuesta muy rápido. Además, las fotos están preciosas. Sin duda, una experiencia a repetir.",
      fr: "C'est la deuxième année consécutive que nous avons fait notre album de Noël en famille avec Rui et, encore une fois, nous avons vécu une superbe expérience. Il est très sympathique, professionnel et attentionné. Il est toujours disponible et a répondu à toutes nos demandes et préférences dans la composition de l'album, avec un temps de réponse toujours très rapide. En plus, les photos sont magnifiques. Sans aucun doute une expérience à refaire.",
    },
  },
  {
    id: "7f415ade-bfe3-4d43-96c4-6ed3a07f33ce",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui é um excelente profissional. Sabe o que fazer sem precisar de instruções e consegue passar despercebido para captar os momentos realmente importantes.\nMuito grato pela experiência, recomendo-o a 100%.",
      de: "Rui ist ein hervorragender Profi. Er weiß, was zu tun ist, ohne dass man ihm Anweisungen geben muss, und schafft es, im Hintergrund zu bleiben und genau die wirklich wichtigen Momente einzufangen.\nIch bin sehr dankbar für die Erfahrung und empfehle ihn zu 100 %.",
      es: "Rui es un excelente profesional. Sabe qué hacer sin que tengas que darle instrucciones y consigue pasar desapercibido para captar los momentos realmente importantes.\nMuy agradecido por la experiencia, lo recomiendo al 100%.",
      fr: "Rui est un excellent professionnel. Il sait quoi faire sans qu'on lui donne d'instructions et parvient à se faire discret pour capturer les moments vraiment importants.\nTrès reconnaissant pour cette expérience, je le recommande à 100 %.",
    },
  },
  {
    id: "4d9a8f38-c47b-40fd-a923-e72a255ae54b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Serviço de 5 estrelas! Simpático, atento e meticuloso com a dinâmica da celebração e da festa. Profissional e descontraído ao mesmo tempo, sempre atento ao detalhe.",
      de: "5-Sterne-Service! Freundlich, aufmerksam und akribisch im Umgang mit der Dynamik der Feier und der Party. Professionell und gleichzeitig entspannt, immer mit Liebe zum Detail.",
      es: "¡Servicio de 5 estrellas! Amable, atento y meticuloso con la dinámica de la celebración y la fiesta. Profesional y a la vez relajado, siempre atento al detalle.",
      fr: "Service 5 étoiles ! Sympathique, attentif et méticuleux avec la dynamique de la cérémonie et de la fête. Professionnel et détendu à la fois, toujours attentif au détail.",
    },
  },
  {
    id: "f4b351fb-3498-4d48-8737-c4859f1f87de",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Muito profissional, mas, acima de tudo, muito atento e delicado.\nAdorámos o produto final.",
      de: "Sehr professionell, aber vor allem sehr aufmerksam und feinfühlig.\nWir haben das Endergebnis geliebt.",
      es: "Muy profesional, pero, sobre todo, muy atento y delicado.\nNos encantó el resultado final.",
      fr: "Très professionnel, mais surtout très attentif et délicat.\nNous avons adoré le produit final.",
    },
  },
  {
    id: "bb179b5d-c450-4961-9ac5-9c11515e5299",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Christina é uma fotógrafa incrível, que já fez sessões maravilhosas para mim e para a minha família. É simpática e agradável — é fácil descontrair com ela, o que é importante para mim, porque não gosto de ser fotografada, fico tensa e tímida. A Christina, magicamente, capta planos vivos, brilhantes, cheios de emoções e cores! As fotos dela recebem sempre montes de \"likes\" nas redes sociais. Aconselha o fundo, a pose e cria a atmosfera certa. E, depois de um momento agradável passado com ela, ainda recebes umas fotos incríveis.",
      de: "Christina ist eine fantastische Fotografin, die schon wunderschöne Shootings für mich und meine Familie gemacht hat. Sie ist nett und angenehm — bei ihr fällt es leicht, sich zu entspannen, was für mich wichtig ist, weil ich mich nicht gerne fotografieren lasse: Ich bin verkrampft und schüchtern. Christina holt magisch Aufnahmen heraus — lebendig, leuchtend, voller Emotionen und Farben! Ihre Fotos bekommen in den sozialen Medien jedes Mal jede Menge Likes. Sie berät dich beim Hintergrund, bei der Pose und schafft die richtige Atmosphäre. Und nach einer einfach schönen gemeinsamen Zeit mit ihr bekommst du obendrein großartige Fotos.",
      es: "Christina es una fotógrafa increíble que ha hecho preciosas sesiones para mí y para mi familia. Es amable y agradable, con ella es fácil relajarse, lo cual para mí es importante porque no me gusta que me hagan fotos, me pongo tensa y tímida. Christina, mágicamente, saca tomas vivas, luminosas, llenas de emociones y de colores. Sus fotos siempre reciben un montón de \"me gusta\" en redes sociales. Te aconseja el fondo, la pose y crea la atmósfera adecuada. Y, tras pasar un buen rato con ella, encima te llevas unas fotos increíbles.",
      fr: "Christina est une photographe incroyable qui a déjà fait de magnifiques séances pour moi et ma famille. Elle est gentille et agréable — il est facile de se détendre avec elle, ce qui est important pour moi, car je n'aime pas être photographiée, je suis crispée et timide. Christina arrive, comme par magie, à sortir des clichés vivants, lumineux, pleins d'émotions et de couleurs ! Ses photos reçoivent toujours plein de likes sur les réseaux sociaux. Elle te conseille pour le fond, pour la pose, et crée la bonne ambiance. Et, après un moment agréable passé avec elle, tu repars avec des photos incroyables.",
    },
  },
  {
    id: "75fd7ca1-5d52-48b6-aeda-2052e8731cd9",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Ola cria uma atmosfera incrível para crianças — recomendo-a vivamente! Foi a nossa primeira sessão e, no início, não foi fácil, mas ele soltou-se e agora o Samuel está sempre a perguntar quando vamos voltar à praia com a Ola 😅",
      de: "Ola schafft eine fantastische Atmosphäre für Kinder — ich empfehle sie wärmstens! Es war unsere erste Session, und am Anfang war es nicht ganz einfach, aber er ist aufgetaut, und jetzt fragt Samuel ständig, wann wir wieder mit Ola an den Strand gehen 😅",
      es: "Ola crea un ambiente increíble para los niños — ¡la recomiendo muchísimo! Fue nuestra primera sesión y al principio no fue fácil, pero él se soltó, y ahora Samuel no para de preguntar cuándo volvemos a la playa con Ola 😅",
      fr: "Ola crée une ambiance incroyable pour les enfants — je la recommande vivement ! C'était notre première séance et ce n'était pas évident au début, mais il s'est rapidement détendu, et maintenant Samuel n'arrête pas de demander quand on retourne à la plage avec Ola 😅",
    },
  },
  {
    id: "f5932cfb-a9c9-4b98-b27e-98bbf51b20e4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Toda a gente está encantada — muito obrigada ❤️❤️❤️❤️",
      de: "Alle sind begeistert — vielen lieben Dank ❤️❤️❤️❤️",
      es: "Todo el mundo está encantado — mil gracias ❤️❤️❤️❤️",
      fr: "Tout le monde est ravi — merci beaucoup ❤️❤️❤️❤️",
    },
  },
  {
    id: "f78f41c6-8396-4ed7-b5c5-b4c81c4c7a4a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fiz uma sessão fotográfica com a Sophie para ter fotos profissionais para o meu site, e a experiência foi incrível do início ao fim. Desde a nossa primeira conversa sobre ideias até aos resultados finais, senti-me verdadeiramente ouvida, vista e completamente confortável.\nA sessão em si foi mesmo divertida — a Sophie tem uma forma muito natural e calorosa de nos pôr à vontade, e a sua perspetiva criativa tornou todo o processo agradável e inspirador. Adoro as fotos, porque captou o meu eu autêntico, e isso deixa-me incrivelmente feliz. Obrigada, Sophie!",
      de: "Ich hatte ein Fotoshooting mit Sophie, um professionelle Bilder für meine Website zu bekommen, und die Erfahrung war von Anfang bis Ende wunderbar. Von unserem ersten Gespräch über Ideen bis hin zum Endergebnis habe ich mich wirklich gehört, gesehen und absolut wohl gefühlt.\nDas Shooting selbst hat so viel Spaß gemacht — Sophie hat eine sehr natürliche, herzliche Art, einen entspannen zu lassen, und ihre kreative Perspektive hat den ganzen Prozess angenehm und inspirierend gemacht. Ich liebe die Fotos absolut, weil sie meine wahre, authentische Persönlichkeit eingefangen hat, und das macht mich unglaublich glücklich. Danke, Sophie!",
      es: "Hice una sesión con Sophie para tener fotos profesionales para mi web, y la experiencia fue increíble de principio a fin. Desde nuestra primera conversación sobre ideas hasta los resultados finales, me sentí escuchada, vista y completamente cómoda.\nLa sesión fue muy divertida — Sophie tiene una forma muy natural y cálida de ponerte a gusto, y su perspectiva creativa hizo que todo el proceso fuera ameno e inspirador. Me encantan las fotos, porque captó mi yo auténtico, y eso me hace increíblemente feliz. ¡Gracias, Sophie!",
      fr: "J'ai fait une séance photo avec Sophie pour avoir des photos professionnelles pour mon site web, et l'expérience a été incroyable du début à la fin. De notre première conversation sur les idées jusqu'aux résultats finaux, je me suis sentie vraiment écoutée, vue et complètement à l'aise.\nLa séance en elle-même a été tellement amusante — Sophie a une manière très naturelle et chaleureuse de vous mettre à l'aise, et sa perspective créative a rendu tout le processus agréable et inspirant. J'adore mes photos parce qu'elle a capturé mon moi authentique, et cela me rend incroyablement heureuse. Merci, Sophie !",
    },
  },
  {
    id: "e09f7e6a-f0a2-4999-a849-792e0eefc3be",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorei a seleção que a Cindy fez para a nossa família! Estão todas tão bonitas, adoramos todas! Muito obrigada!",
      de: "Ich liebe die Auswahl, die Cindy für unsere Familie getroffen hat! Sie sind alle so schön, wir lieben jede einzelne! Vielen lieben Dank!",
      es: "¡Me encantó la selección que hizo Cindy para nuestra familia! Están todas tan bonitas, ¡nos encantan todas! ¡Mil gracias!",
      fr: "J'adore la sélection que Cindy a faite pour notre famille ! Elles sont toutes si belles, nous les adorons toutes ! Merci beaucoup !",
    },
  },
  {
    id: "9a5fa7ac-1431-4dc8-b7aa-926f6e6bd1c9",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uma excelente profissional, que fez toda a diferença num dia tão especial! Adorámos cada detalhe ☺️ Não podíamos recomendar mais!",
      de: "Eine hervorragende Profi, die an einem so besonderen Tag den entscheidenden Unterschied gemacht hat! Wir haben jedes Detail geliebt ☺️ Wir können sie nur wärmstens empfehlen!",
      es: "¡Una excelente profesional que marcó la diferencia en un día tan especial! Nos encantó cada detalle ☺️ ¡No podríamos recomendarla más!",
      fr: "Une excellente professionnelle qui a fait toute la différence lors d'une journée si spéciale ! Nous avons adoré chaque détail ☺️ Nous ne pourrions pas la recommander davantage !",
    },
  },
  {
    id: "8914ecf0-b520-4c9e-8ec1-3ac6e4387ab2",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Uma excelente profissional, extremamente dedicada, que nos deixou completamente à vontade durante todo o processo.",
      de: "Eine hervorragende Profi, extrem engagiert, die uns während des gesamten Prozesses absolut entspannen ließ.",
      es: "Una excelente profesional, extremadamente dedicada, que nos hizo sentir completamente cómodos durante todo el proceso.",
      fr: "Une excellente professionnelle, extrêmement dévouée, qui nous a complètement mis à l'aise tout au long du processus.",
    },
  },
  {
    id: "054e3c25-6fb7-40c0-86cc-ce75aa3e4861",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Um lindo registo de um dia de sonho em Abrantes. O José captou a atmosfera e a emoção do momento na perfeição, e cada vez que olho para as fotos sou levada de imediato para lá. Recomendo vivamente.",
      de: "Eine wunderschöne Erinnerung an einen Traumtag in Abrantes. José hat die Atmosphäre und die Emotion des Augenblicks perfekt eingefangen, und jedes Mal, wenn ich die Fotos ansehe, bin ich sofort wieder dort. Sehr zu empfehlen.",
      es: "Un precioso registro de un día de ensueño en Abrantes. José captó a la perfección la atmósfera y la emoción del momento, y cada vez que miro las fotos me transporto allí al instante. Lo recomiendo muchísimo.",
      fr: "Un magnifique souvenir d'une journée de rêve à Abrantes. José a parfaitement capturé l'atmosphère et l'émotion du moment, et chaque fois que je regarde les photos, je suis immédiatement transportée là-bas. Vivement recommandé.",
    },
  },
  {
    id: "bbfc9c8e-b466-4e58-bc73-a29f80bc1464",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Masha, muito obrigada. Consegui fazer o download de tudo — vamos ver as fotos amanhã. Acabámos de regressar de Espanha; saudações de Sevilha, ainda linda e que já dá vontade de voltar. Mais uma vez obrigada, ficou tudo mesmo lindo. Ótima recordação. Vou respirar e depois ver que outras opções existem para encomendar algo para guardar como recordação.",
      de: "Masha, vielen lieben Dank. Ich habe alles heruntergeladen — wir werden uns die Fotos morgen ansehen. Wir sind gerade aus Spanien zurückgekommen; liebe Grüße aus Sevilla, immer noch wunderschön, und ich möchte schon wieder hin. Nochmals vielen Dank, alles ist wirklich schön geworden. Eine tolle Erinnerung. Ich atme jetzt erstmal durch und schaue dann, welche Optionen es gibt, um etwas als Erinnerung zu bestellen.",
      es: "Masha, muchísimas gracias. Conseguí descargar todo — mañana revisamos las fotos. Acabamos de volver de España; saludos desde Sevilla, sigue siendo preciosa y ya dan ganas de volver. De nuevo gracias, todo quedó realmente precioso. Un recuerdo magnífico. Voy a respirar un poco y después miraré qué otras opciones hay para encargar algo como recuerdo.",
      fr: "Masha, merci beaucoup. J'ai réussi à tout télécharger — on regardera les photos demain. Nous venons juste de rentrer d'Espagne ; salutations de Séville, toujours aussi belle et on a déjà envie d'y retourner. Merci encore, tout est vraiment magnifique. Un super souvenir. Je vais respirer un peu et ensuite je regarderai quelles autres options existent pour commander quelque chose à garder en souvenir.",
    },
  },
  {
    id: "57816d67-4f03-410d-b441-4e4497171107",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Maria, querida, muito obrigada por hoje. Já tinha ouvido tantas coisas boas sobre ti à Katya — tinha visto o teu trabalho e admirava-o sempre. Foi tão bom finalmente conhecer-te pessoalmente e trabalhar contigo. Tenho a certeza de que isto é só o início e teremos muitas mais sessões e, possivelmente, projetos juntas no futuro. Obrigada, e estou mesmo, mesmo ansiosa por ver os resultados.",
      de: "Maria, meine Liebe, vielen Dank für heute. Ich hatte schon so viele tolle Dinge von Katya über dich gehört — ich kannte deine Arbeit und habe sie immer bewundert. Es war wunderschön, dich endlich persönlich zu treffen und mit dir zu arbeiten. Ich bin mir sicher, das ist erst der Anfang, und wir werden in Zukunft noch viele Shootings und vielleicht gemeinsame Projekte haben. Danke, und ich kann es wirklich, wirklich kaum erwarten, die Ergebnisse zu sehen.",
      es: "Maria, querida, muchísimas gracias por hoy. Ya había oído tantas cosas buenas sobre ti por parte de Katya — había visto tu trabajo y siempre lo había admirado. Fue maravilloso conocerte por fin en persona y trabajar contigo. Estoy segura de que esto es solo el principio y de que tendremos muchas más sesiones y, quizá, proyectos juntas en el futuro. Gracias, y de verdad, de verdad, no veo la hora de ver los resultados.",
      fr: "Maria, ma chère, merci infiniment pour aujourd'hui. J'avais déjà tellement entendu de bien sur toi par Katya — j'avais vu ton travail et je l'admirais depuis longtemps. Cela a été tellement agréable de te rencontrer enfin en personne et de travailler avec toi. Je suis sûre que ce n'est que le début et que nous aurons beaucoup d'autres séances et, peut-être, des projets ensemble à l'avenir. Merci, et j'ai vraiment, vraiment hâte de voir les résultats.",
    },
  },
  {
    id: "696aeb82-8915-4f64-85a6-8a4971c0b1d6",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "És mesmo uma fotógrafa incrível. Muito obrigada — a galeria está linda, não podia estar mais feliz.",
      de: "Du bist wirklich eine fantastische Fotografin. Vielen lieben Dank — die Galerie ist wunderschön geworden, ich könnte nicht glücklicher sein.",
      es: "De verdad eres una fotógrafa increíble. Muchísimas gracias — la galería está preciosa, no podría estar más feliz.",
      fr: "Tu es vraiment une photographe incroyable. Merci beaucoup — la galerie est magnifique, je ne pourrais pas être plus heureuse.",
    },
  },
  {
    id: "c752dd42-d7d2-4a21-9d96-5fb5529fca31",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Oaoaoa, Lenaaa! Obrigaaada 😍 Deixa-me só passar a confusão do aniversário e depois vou ver tudo com calma! Por acaso, não consegui esperar e já vi todas. É tão lindo que parece irreal — gosto de mim em todas as fotos!",
      de: "Oaoaoa, Lenaaa! Daaanke 😍 Lass mich erst diesen Geburtstagsstress hinter mich bringen, dann gucke ich in Ruhe alles an! Eigentlich konnte ich nicht warten und habe sie mir schon alle angesehen. Es ist so schön, dass es fast unwirklich wirkt — ich mag mich auf jedem einzelnen Foto!",
      es: "¡Oaoaoa, Lenaaa! ¡Graaacias! 😍 Déjame que pase el follón del cumpleaños y después miro todo con calma. La verdad es que no pude esperar y ya las vi todas. Es tan bonito que parece irreal — ¡me gusto en cada una de las fotos!",
      fr: "Oaoaoa, Lenaaa ! Mercii 😍 Laisse-moi juste passer le tumulte de l'anniversaire et ensuite je regarderai tout tranquillement ! En fait, je n'ai pas pu attendre et je les ai déjà toutes regardées. C'est tellement beau que c'en est irréel — je m'aime sur chacune des photos !",
    },
  },
  {
    id: "bd4e399d-74c9-48dc-9a52-7eec72700608",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana fez uma seleção incrível, obrigada! Estamos super felizes com todas. Queria também agradecer-te muito por nos teres feito sentir tão à vontade durante a sessão! Isso tornou toda a experiência e a noite muito especiais. E, claro, foi super giro conhecer-te 🥰",
      de: "Tatiana hat eine fantastische Auswahl getroffen, danke! Wir sind super glücklich mit jedem einzelnen Bild. Ich wollte mich auch ganz besonders dafür bedanken, dass du uns während des Shootings so entspannt sein lassen hast! Das hat das gesamte Erlebnis und den Abend wirklich besonders gemacht. Und natürlich war es super schön, dich kennenzulernen 🥰",
      es: "¡Tatiana hizo una selección increíble, gracias! Estamos súper felices con todas. También quería agradecerte muchísimo que nos hicieras sentir tan cómodos durante la sesión. Eso hizo que toda la experiencia y la noche fueran muy especiales. Y por supuesto, fue genial conocerte 🥰",
      fr: "Tatiana a fait une superbe sélection, merci ! Nous en sommes super heureux. Je voulais aussi te remercier énormément de nous avoir mis autant à l'aise pendant la séance ! Cela a rendu toute l'expérience et la soirée très spéciales. Et bien sûr, c'était super sympa de faire ta connaissance 🥰",
    },
  },
  {
    id: "a6c12cf4-a87f-4bbb-8d34-482f1175a9a0",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Olá Tatiana, muchas gracias! Estou muito feliz e já guardei tudo, obrigada. Foi ótimo trabalhar contigo — a atmosfera, os locais e as fotos finais foram todos maravilhosos.",
      de: "Hallo Tatiana, muchas gracias! Ich bin überglücklich und habe schon alles gesichert, danke. Es war wunderbar, mit dir zu arbeiten — die Atmosphäre, die Locations und die finalen Fotos waren alle traumhaft.",
      es: "Hola Tatiana, muchas gracias! Estoy muy feliz y ya he guardado todo, gracias. Fue genial trabajar contigo — el ambiente, los sitios y las fotos finales fueron maravillosos.",
      fr: "Salut Tatiana, muchas gracias ! Je suis très heureuse et j'ai déjà tout sauvegardé, merci. Cela a été génial de travailler avec toi — l'ambiance, les lieux et les photos finales étaient tous magnifiques.",
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
console.log(`\nBatch rev-5 done — ${REV.length} reviews translated.`);
