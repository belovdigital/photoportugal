// Reviews batch 2 — next 60 reviews → PT/DE/ES/FR
import pg from "pg";
const { Client } = pg;

const REV = [
  {
    id: "c5a654e2-f793-4395-a651-dfb111a71075",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Profissionais que amam o que fazem, e isso diz tudo sobre o serviço. 🥰🥰🥰 Adorei e recomendo. …",
      de: "Profis, die lieben, was sie tun — und das sagt alles über den Service. 🥰🥰🥰 Ich war begeistert und kann es nur empfehlen. …",
      es: "Profesionales que aman lo que hacen, y eso lo dice todo sobre el servicio. 🥰🥰🥰 Me encantó y lo recomiendo. …",
      fr: "Des professionnels qui aiment ce qu'ils font, et ça dit tout sur le service. 🥰🥰🥰 J'ai adoré et je recommande. …",
    },
  },
  {
    id: "1715760c-9236-4986-9d06-b14d1f9b6cee",
    title: { pt: "Sessão fotográfica", de: "Fotosession", es: "Sesión fotográfica", fr: "Séance photo" },
    text: {
      pt: "Uma profissional de topo! Dedicada, empática, talentosa, trabalhadora!\n\nCapta o que há de mais belo nas pessoas! Repara nos detalhes e realça-os de uma forma maravilhosa!\n\nEspetacular.",
      de: "Eine Profi der Spitzenklasse! Engagiert, einfühlsam, talentiert, fleißig!\n\nSie fängt das Schönste in den Menschen ein! Sie sieht die Details und bringt sie auf wunderbare Weise zur Geltung!\n\nSpektakulär.",
      es: "¡Una profesional de primer nivel! ¡Dedicada, empática, talentosa, trabajadora!\n\n¡Capta lo más bonito de las personas! ¡Se fija en los detalles y los realza de una manera maravillosa!\n\nEspectacular.",
      fr: "Une professionnelle au top ! Dévouée, empathique, talentueuse, travailleuse !\n\nElle capture ce qu'il y a de plus beau chez les gens ! Elle remarque les détails et les met en valeur de façon merveilleuse !\n\nSpectaculaire.",
    },
  },
  {
    id: "f406438b-0583-4481-bac5-6d1d8d1e7ff5",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Patricia e Fernando, vocês são INCRÍVEIS! :) Não fazia ideia de que era tão bonita antes de vos conhecer. Fizeram-me sentir confortável, super bem-vinda, e foi tão fácil e divertido convosco que nem imaginava que pudesse ser assim com pessoas que se acabaram de conhecer. O resultado final é simplesmente deslumbrante! Continuo a olhar para as fotos e estão tão bonitas! Muito obrigada pela vossa simpatia, profissionalismo, talento, visão e cuidado. Vou voltar de certeza para outra sessão convosco! <3",
      de: "Patricia und Fernando, ihr seid GROSSARTIG! :) Mir war nicht klar, wie hübsch ich bin, bevor ich euch getroffen habe. Ihr habt mir das Gefühl gegeben, willkommen und entspannt zu sein, und mit euch war es so leicht und so lustig, dass ich mir gar nicht vorstellen konnte, dass es mit Menschen, die man gerade erst kennenlernt, so sein kann. Das Ergebnis ist einfach atemberaubend! Ich schaue mir die Fotos immer wieder an und sie sind wunderschön! Vielen Dank für eure Freundlichkeit, Professionalität, euer Talent, eure Vision und Fürsorge. Ich komme ganz sicher für ein weiteres Shooting mit euch zurück! <3",
      es: "Patricia y Fernando, ¡sois INCREÍBLES! :) No sabía que era tan guapa hasta que os conocí. Me hicisteis sentir cómoda, súper bienvenida, y fue tan fácil y divertido con vosotros que no podía imaginar que pudiera ser así con personas a las que acabas de conocer. ¡El resultado final es simplemente espectacular! Sigo mirando las fotos y son preciosas. Muchísimas gracias por vuestra amabilidad, profesionalidad, talento, visión y cuidado. ¡Volveré sin duda para otra sesión con vosotros! <3",
      fr: "Patricia et Fernando, vous êtes EXTRAORDINAIRES ! :) Je ne savais pas que j'étais si jolie avant de vous rencontrer. Vous m'avez mise à l'aise, super bien accueillie, et c'était si simple et amusant avec vous que je n'imaginais pas que cela puisse l'être avec des gens que l'on vient de rencontrer. Le résultat final est tout simplement magnifique ! Je n'arrête pas de regarder les photos, elles sont superbes ! Merci infiniment pour votre gentillesse, votre professionnalisme, votre talent, votre vision et votre attention. Je reviendrai sans aucun doute pour une autre séance avec vous ! <3",
    },
  },
  {
    id: "d0ee1a65-19d2-4dcd-a0de-a8c675369c3d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A minha namorada e eu tivemos uma experiência maravilhosa na sessão com a Patricia! É detalhista, atenciosa e torna todo o processo muito fluido. As fotos ficaram lindas e estamos apaixonados por elas! Recomendo vivamente que contactem a Patricia quando estiverem em Lisboa.",
      de: "Meine Freundin und ich hatten ein wundervolles Shooting-Erlebnis mit Patricia! Sie ist detailverliebt, aufmerksam und macht den ganzen Ablauf reibungslos. Die Fotos sind wunderschön geworden und wir sind verliebt darin! Ich kann nur jedem empfehlen, Patricia in Lissabon zu kontaktieren.",
      es: "Mi novia y yo tuvimos una experiencia maravillosa en la sesión con Patricia. Es detallista, atenta y hace que todo el proceso fluya. ¡Las fotos quedaron preciosas y estamos enamorados de ellas! Recomiendo muchísimo contactar con Patricia cuando estés en Lisboa.",
      fr: "Ma copine et moi avons vécu une expérience merveilleuse avec Patricia ! Elle est minutieuse, attentionnée et rend tout le processus fluide. Les photos sont magnifiques et nous en sommes complètement amoureux ! Je recommande vivement de contacter Patricia quand vous êtes à Lisbonne.",
    },
  },
  {
    id: "9a6e40ca-f010-4f10-81d9-2f656bb20f86",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "\"Fenomenal\" nem sequer chega para descrever a competência, dedicação, profissionalismo e simpatia desta equipa! Tivemos um processo de sessão de noivado fantástico e profundamente satisfatório com a Borderland — eles tiveram o maior cuidado em compreender o que queríamos e em entregar o resultado perfeito para nós. Muito gratos a ambos!",
      de: "\"Phänomenal\" wird der Kompetenz, dem Engagement, der Professionalität und der Herzlichkeit dieses Teams nicht einmal annähernd gerecht! Wir hatten ein fantastisches und absolut erfüllendes Verlobungsshooting mit Borderland — sie haben sich mit größter Sorgfalt darum gekümmert, das perfekte Ergebnis für uns zu liefern. Wir sind euch beiden so dankbar!",
      es: "¡\"Fenomenal\" se queda corto para describir la competencia, dedicación, profesionalidad y simpatía de este equipo! Tuvimos una experiencia fantástica y profundamente gratificante con la sesión de compromiso con Borderland — pusieron el máximo cuidado en entender lo que queríamos y entregarnos el resultado perfecto. ¡Muy agradecidos a los dos!",
      fr: "\"Phénoménal\" n'est même pas suffisant pour décrire la compétence, le dévouement, le professionnalisme et la gentillesse de cette équipe ! Nous avons vécu une séance de fiançailles fantastique et profondément satisfaisante avec Borderland — ils ont mis le plus grand soin à comprendre ce que nous voulions et à nous livrer le résultat parfait. Merci infiniment à vous deux !",
    },
  },
  {
    id: "398bf75a-c4bd-4a46-a8ea-31e58be07f05",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi simplesmente uma experiência maravilhosa fazer uma sessão com a Sophie e as fotos são uma recordação fantástica. Já tive duas sessões com a Sophie e ela foi sempre muito paciente, profissional, criativa, experiente e divertida. Passámos um bom momento. Ambas as sessões foram com o nosso bebé, que andava a correr para todo o lado o tempo todo. Foi quase mágico como a Sophie conseguiu captá-lo! As fotos são super profissionais, super naturais e bonitas, por isso posso usá-las tanto a nível pessoal como profissional.\nObrigada, Sophie, espero ter outra sessão muito em breve :-)",
      de: "Es war einfach eine tolle Erfahrung, ein Shooting mit Sophie zu haben, und die Bilder sind eine wunderbare Erinnerung. Ich hatte schon zwei Shootings mit Sophie und sie war immer sehr geduldig, professionell, kreativ, erfahren und lustig. Wir hatten einfach eine schöne Zeit. Beide Shootings fanden zusammen mit unserem Kleinkind statt, das die ganze Zeit herumgerannt ist. Es war wie Magie, dass Sophie ihn so eingefangen hat! Die Bilder sind hochprofessionell, super natürlich und schön — ich kann sie sowohl privat als auch beruflich nutzen.\nDanke, Sophie, ich hoffe auf ein weiteres Shooting ganz bald :-)",
      es: "Simplemente fue una experiencia genial hacer una sesión con Sophie, y las fotos son un recuerdo maravilloso. Ya he hecho dos sesiones con Sophie, y siempre ha sido muy paciente, profesional, creativa, experimentada y divertida. Lo pasamos genial. Las dos sesiones fueron con nuestro pequeño, que estuvo corriendo de un lado a otro todo el tiempo. ¡Fue casi mágico cómo Sophie consiguió fotografiarlo! Las fotos son muy profesionales, súper naturales y preciosas, así que puedo usarlas tanto a nivel personal como profesional.\nGracias, Sophie, ¡espero hacer otra sesión muy pronto! :-)",
      fr: "Faire une séance avec Sophie a tout simplement été une formidable expérience, et les photos sont un merveilleux souvenir. J'avais déjà fait deux séances avec Sophie, et elle a toujours été très patiente, professionnelle, créative, expérimentée et drôle. Nous avons passé un super moment. Les deux séances se sont déroulées avec notre tout-petit, qui courait partout en permanence. C'est presque magique de voir comment Sophie a réussi à le capturer ! Les photos sont très professionnelles, super naturelles et magnifiques, je peux donc les utiliser aussi bien à titre personnel que professionnel.\nMerci, Sophie, j'espère refaire une séance très bientôt :-)",
    },
  },
  {
    id: "94c8cc65-df07-46d0-9c49-2acfb5b6215a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Super simpática e profissional. Recomendo a todos :)",
      de: "Super freundlich und professionell. Ich kann sie jedem empfehlen :)",
      es: "Súper amable y profesional. Lo recomiendo a todo el mundo :)",
      fr: "Super sympa et professionnelle. Je recommande à tout le monde :)",
    },
  },
  {
    id: "cec558cb-2727-4a91-90e0-a2a72464a947",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Serviço incrível. Muito feliz com o resultado :))",
      de: "Großartiger Service. Mit dem Ergebnis bin ich super zufrieden :))",
      es: "Servicio increíble. Muy contenta con el resultado :))",
      fr: "Service incroyable. Très contente du résultat :))",
    },
  },
  {
    id: "a6fe59e7-d262-49cc-8628-343f6952f9af",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana foi excelente a fazer com que eu me sentisse à vontade e captou todo o ambiente lisboeta nas fotos. Recomendo totalmente!",
      de: "Tatiana hat es wunderbar geschafft, dass ich mich entspannt fühle, und hat das ganze Lissabon-Feeling in den Fotos eingefangen. Absolute Empfehlung!",
      es: "Tatiana fue increíble haciéndome sentir relajada y captando todo el ambiente lisboeta en las fotos. ¡Totalmente recomendable!",
      fr: "Tatiana a été formidable pour me mettre à l'aise et capturer toute l'ambiance lisboète dans les photos. Je recommande complètement !",
    },
  },
  {
    id: "57ee96f9-6895-43e9-979b-f8fde6a63c36",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi uma experiência fantástica! A Tatiana é muito simpática e agradável. É super talentosa e faz-nos sentir à vontade. Dedicou tempo a perceber que tipo de fotos eu queria, e as que tirou foram ainda melhores do que eu esperava. Queria fotos naturais com o lindo cenário de Lisboa, e foi exatamente isso que recebi. Recomendo muito esta experiência! Estou muito feliz com as minhas fotos — as melhores que já tive em férias!",
      de: "Das war eine fantastische Erfahrung! Tatiana ist sehr freundlich und angenehm im Umgang. Sie ist sehr talentiert und sorgt dafür, dass man sich entspannt fühlt. Sie hat sich Zeit genommen zu verstehen, welche Art von Fotos ich wollte, und die Fotos sind besser geworden, als ich erwartet hatte. Ich wollte natürliche Bilder vor der wunderschönen Lissabon-Kulisse — und genau das habe ich bekommen. Diese Erfahrung kann ich nur empfehlen! Ich bin sehr zufrieden mit meinen Bildern — die besten, die ich je im Urlaub hatte!",
      es: "¡Fue una experiencia fantástica! Tatiana es una persona muy amable y cercana. Tiene muchísimo talento y te hace sentir cómoda. Se tomó el tiempo de entender qué tipo de fotos quería y las que hizo superaron lo que esperaba. Quería fotos naturales con el precioso fondo de Lisboa, y es justo lo que conseguí. ¡Recomiendo muchísimo esta experiencia! Súper contenta con mis fotos, ¡las mejores que he tenido nunca en unas vacaciones!",
      fr: "Une expérience fantastique ! Tatiana est une personne très sympathique et agréable. Elle est super talentueuse et vous met à l'aise. Elle a pris le temps de comprendre quel type de photos je voulais, et celles qu'elle a prises ont dépassé mes attentes. Je voulais des photos naturelles avec le magnifique décor de Lisbonne, et c'est exactement ce que j'ai eu. Je recommande vivement cette expérience ! Très heureuse de mes photos — les plus belles que j'aie jamais eues en vacances !",
    },
  },
  {
    id: "06e06aaf-1339-4120-bbef-66b1ac9b6db4",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Tatiana é muito simpática, encontra ótimos sítios para fotografar e faz-nos sentir à vontade!",
      de: "Tatiana ist sehr freundlich, findet tolle Foto-Spots und sorgt dafür, dass man sich wohlfühlt!",
      es: "¡Tatiana es muy maja, encuentra sitios geniales para fotografiar y te hace sentir cómoda!",
      fr: "Tatiana est très sympa, elle trouve de superbes spots photo et vous met à l'aise !",
    },
  },
  {
    id: "d57b8eaf-5084-479b-b15a-eb302e07ef68",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adoramos o trabalho desta equipa.",
      de: "Wir lieben die Arbeit dieses Teams.",
      es: "Nos encanta el trabajo de este equipo.",
      fr: "Nous adorons le travail de cette équipe.",
    },
  },
  {
    id: "7c4537c1-d56f-4468-b479-58653b2d6c48",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A sessão \"Liberte-se\" foi uma experiência incrível; a Chris e a Scar são super atentas e pensam em cada momento da sessão para que nos sintamos verdadeiras deusas. Adorei fazer parte dos cliques da Photo Zênite <3",
      de: "Die Session „Liberte-se\" (Befrei dich!) war eine unglaubliche Erfahrung — Chris und Scar sind extrem aufmerksam und durchdenken jeden Moment des Shootings, damit man sich wie eine Göttin fühlt. Ich habe es geliebt, Teil der Bilder von Photo Zênite zu sein <3",
      es: "La sesión \"Liberte-se\" (Libérate) fue una experiencia increíble; Chris y Scar están súper atentas y piensan cada momento del shoot para que te sientas como una diosa. Me encantó formar parte de los clics de Photo Zênite <3",
      fr: "La séance \"Liberte-se\" (Libère-toi) a été une expérience incroyable ; Chris et Scar sont super attentionnées et pensent à chaque moment du shooting pour qu'on se sente comme des déesses. J'ai adoré faire partie des clichés de Photo Zênite <3",
    },
  },
  {
    id: "f1f432f8-9df9-463e-b405-39317debf38e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A melhor fotógrafa de sempre! Atenta, entusiasta! Faz-nos sentir confortáveis e respeita as nossas opiniões. Trata-nos como iguais, sem julgamentos! Adorei!",
      de: "Die beste Fotografin überhaupt! Aufmerksam, voller Begeisterung! Sie sorgt dafür, dass man sich wohlfühlt, und respektiert deine Meinung. Sie begegnet einem auf Augenhöhe, ohne zu urteilen! Ich habe es geliebt!",
      es: "¡La mejor fotógrafa de siempre! ¡Atenta, entusiasta! Te hace sentir cómoda y respeta tus opiniones. ¡Te trata de igual a igual, sin juzgar! ¡Me encantó!",
      fr: "La meilleure photographe de tous les temps ! Attentive, enthousiaste ! Elle vous met à l'aise et respecte vos opinions. Elle vous traite d'égal à égal, sans jugement ! J'ai adoré !",
    },
  },
  {
    id: "28ec3d3a-df8c-46d9-9045-c4051bc083ab",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Sem dúvida, a melhor fotógrafa! A Cris é uma pessoa de luz incrível, sempre alegre, e uma grande profissional!",
      de: "Ohne Zweifel die beste Fotografin! Cris ist ein Mensch mit unglaublich positiver Ausstrahlung, immer fröhlich — und eine fantastische Profi!",
      es: "¡Sin duda, la mejor fotógrafa! ¡Cris es una persona con una luz increíble, siempre alegre, y una gran profesional!",
      fr: "Sans aucun doute, la meilleure photographe ! Cris est une personne d'une lumière incroyable, toujours joyeuse, et une grande professionnelle !",
    },
  },
  {
    id: "e813c424-a8bc-461a-9c73-f0635c839d7f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui é um ótimo profissional, amigo, carismático, flexível, atencioso e com um olhar bem peculiar. O meu casamento foi muito íntimo e simples, exatamente como queríamos, e ele captou todos os detalhes. As fotos ficaram lindíssimas!",
      de: "Rui ist ein hervorragender Profi, freundlich, charismatisch, flexibel, aufmerksam und mit einem ganz besonderen Blick. Unsere Hochzeit war sehr intim und schlicht, genau so, wie wir es wollten, und er hat jedes Detail eingefangen. Die Fotos sind wunderschön geworden!",
      es: "Rui es un gran profesional, amigable, carismático, flexible, atento y con una mirada muy particular. Mi boda fue muy íntima y sencilla, justo como queríamos, y él captó todos los detalles. ¡Las fotos quedaron preciosísimas!",
      fr: "Rui est un excellent professionnel, amical, charismatique, flexible, attentif et doté d'un regard très singulier. Notre mariage était très intime et simple, exactement comme nous le souhaitions, et il a saisi tous les détails. Les photos sont magnifiques !",
    },
  },
  {
    id: "e889fe3d-c421-4a76-826a-676c05b7bb44",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui registou o nosso dia tal como o sentimos! Feliz e genuíno. O Rui consegue captar na perfeição as expressões e os sentimentos que falam numa imagem! É divertido e muito original! Obrigada Rui por eternizares o nosso dia e teres feito parte dele. És o melhor!",
      de: "Rui hat unseren Tag genau so festgehalten, wie wir ihn erlebt haben! Glücklich und echt. Rui versteht es, Ausdrücke und Gefühle perfekt einzufangen, die in einem einzigen Bild Bände sprechen! Er ist witzig und sehr originell! Danke, Rui, dass du unseren Tag verewigt und ein Teil davon warst. Du bist der Beste!",
      es: "¡Rui registró nuestro día tal y como lo sentimos! Feliz y genuino. ¡Rui consigue captar a la perfección las expresiones y los sentimientos que hablan en una imagen! ¡Es divertido y muy original! Gracias, Rui, por eternizar nuestro día y por haber formado parte de él. ¡Eres el mejor!",
      fr: "Rui a immortalisé notre journée exactement comme nous l'avons ressentie ! Heureuse et authentique. Rui sait capturer à la perfection les expressions et les sentiments qui parlent dans une image ! Il est drôle et très original ! Merci, Rui, d'avoir éternisé notre journée et d'en avoir fait partie. Tu es le meilleur !",
    },
  },
  {
    id: "6c954949-fd7f-4891-8728-a3f3c1558e6a",
    title: {
      pt: "Nem reparámos que estavam ali",
      de: "Wir haben sie kaum bemerkt",
      es: "Ni nos dimos cuenta de que estaban allí",
      fr: "On ne les a même pas remarqués",
    },
    text: {
      pt: "Gostámos muito do Gonçalo e percebemos que tínhamos contratado as pessoas certas porque nem reparámos que estavam ali durante o casamento.\nAgora é esperar pelas fotos finais e pelo vídeo.\nAté agora não podíamos estar mais felizes.\nContratámos 2 fotógrafos e 1 videógrafo.",
      de: "Gonçalo hat uns sehr gut gefallen, und wir haben gemerkt, dass wir die richtigen Leute engagiert hatten — wir haben während der Hochzeit kaum bemerkt, dass sie da waren.\nJetzt heißt es nur noch, auf die finalen Fotos und das Video zu warten.\nBis jetzt könnten wir nicht glücklicher sein.\nWir hatten 2 Fotografen und 1 Videografen gebucht.",
      es: "Nos encantó Gonçalo y nos dimos cuenta de que habíamos contratado a las personas adecuadas porque ni nos dimos cuenta de que estaban allí durante la boda.\nAhora toca esperar las fotos finales y el vídeo.\nDe momento no podríamos estar más contentos.\nContratamos 2 fotógrafos y 1 videógrafo.",
      fr: "Nous avons vraiment apprécié Gonçalo et nous avons compris que nous avions engagé les bonnes personnes parce que nous ne les avons même pas remarqués pendant le mariage.\nMaintenant, il ne reste plus qu'à attendre les photos finales et la vidéo.\nJusqu'ici, nous ne pourrions pas être plus heureux.\nNous avons engagé 2 photographes et 1 vidéaste.",
    },
  },
  {
    id: "bbbc7fc5-fbdc-4c07-afdd-d86b985fa1af",
    title: {
      pt: "Simplesmente incrível..",
      de: "Einfach unglaublich..",
      es: "Simplemente increíble..",
      fr: "Tout simplement incroyable..",
    },
    text: {
      pt: "A Jennifer é uma profissional de topo, que transforma os melhores momentos em algo tão belo e inesquecível como um casamento deve ser. Desde o dia em que a marcámos até ao dia do casamento sentimos que tínhamos feito a melhor escolha pela sua enorme disponibilidade, profissionalismo, simpatia e qualidade do trabalho final. As fotos surpreenderam-nos da melhor forma. Obrigada, querida Jennifer, por captares o nosso dia de uma forma tão especial.",
      de: "Jennifer ist eine erstklassige Profi, die die schönsten Momente in etwas so Wundervolles und Unvergessliches verwandelt, wie eine Hochzeit es sein sollte. Vom Tag der Buchung bis zum Hochzeitstag hatten wir das Gefühl, die beste Wahl getroffen zu haben — dank ihrer großen Verfügbarkeit, ihrer Professionalität, ihrer Freundlichkeit und der Qualität des Endergebnisses. Die Fotos haben uns auf die schönste Weise überrascht. Danke, liebe Jennifer, dass du unseren Tag auf so besondere Weise eingefangen hast.",
      es: "Jennifer es una profesional de primer nivel, que transforma los mejores momentos en algo tan bonito e inolvidable como debe ser una boda. Desde el día en que la reservamos hasta el día de la boda sentimos que habíamos hecho la mejor elección por su enorme disponibilidad, profesionalidad, simpatía y la calidad del trabajo final. Las fotos nos sorprendieron para muy bien. Gracias, querida Jennifer, por captar nuestro día de una forma tan especial.",
      fr: "Jennifer est une professionnelle d'exception, qui transforme les plus beaux moments en quelque chose d'aussi beau et inoubliable que doit l'être un mariage. Du jour où nous l'avons réservée à celui du mariage, nous avons senti que nous avions fait le meilleur choix grâce à sa grande disponibilité, son professionnalisme, sa gentillesse et la qualité du résultat final. Les photos nous ont surpris de la plus belle façon. Merci, chère Jennifer, d'avoir capturé notre journée de manière si spéciale.",
    },
  },
  {
    id: "b5a04e8f-b8cf-402d-bccd-9a4adc86041d",
    title: {
      pt: "Profissional incrível",
      de: "Unglaubliche Profi",
      es: "Profesional increíble",
      fr: "Professionnelle incroyable",
    },
    text: {
      pt: "Não podia ter sido melhor.\n\nUma profissional 5 estrelas.\n\nSempre disponível — recomendo vivamente.",
      de: "Es hätte nicht besser sein können.\n\nEine Profi mit fünf Sternen.\n\nImmer erreichbar — sehr zu empfehlen.",
      es: "No podía haber sido mejor.\n\nUna profesional de 5 estrellas.\n\nSiempre disponible — la recomiendo mucho.",
      fr: "Cela ne pouvait pas être mieux.\n\nUne professionnelle 5 étoiles.\n\nToujours disponible — je la recommande vivement.",
    },
  },
  {
    id: "8c5de2d8-8a2e-4146-aab7-ba3a8d969b52",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Patricia é simplesmente A MELHOR fotógrafa e artista com quem já trabalhei. Não tira apenas \"boas fotos\". A Patricia deixa a sua assinatura, o seu estilo visual e a sua arte em tudo o que faz. Desde a preparação para a sessão, ao conceito, aos adereços, até ao produto final. Para além disso, eu estava super nervosa e nunca me senti tão à vontade a ser fotografada. Agora até quero repetir. Adorei. Obrigada, Patricia, por captares tão bem a minha essência. És incrível.",
      de: "Patricia ist einfach DIE BESTE Fotografin und Künstlerin, mit der ich je gearbeitet habe. Sie macht nicht einfach „gute Fotos\". Patricia hinterlässt in allem, was sie tut, ihre Handschrift, ihren visuellen Stil und ihre Kunst. Von der Vorbereitung des Shootings über das Konzept und die Requisiten bis zum Endprodukt. Außerdem war ich super nervös und habe mich noch nie so wohl dabei gefühlt, fotografiert zu werden. Jetzt möchte ich es sogar wiederholen. Ich habe es geliebt. Danke, Patricia, dass du meine Essenz so gut eingefangen hast. Du bist großartig.",
      es: "Patricia es, sencillamente, LA MEJOR fotógrafa y artista con la que he trabajado. No se limita a hacer \"buenas fotos\". Patricia deja su firma, su estilo visual y su arte en todo lo que hace. Desde la preparación de la sesión, el concepto, los props, hasta el producto final. Además, yo estaba súper nerviosa y nunca me había sentido tan cómoda mientras me fotografiaban. Ahora hasta quiero repetir. Me encantó. Gracias, Patricia, por captar tan bien mi esencia. Eres increíble.",
      fr: "Patricia est tout simplement LA MEILLEURE photographe et artiste avec qui j'ai travaillé. Elle ne fait pas que de \"belles photos\". Patricia laisse sa signature, son style visuel et son art dans tout ce qu'elle fait. De la préparation de la séance, au concept, aux accessoires, jusqu'au produit final. En plus, j'étais super stressée et je ne m'étais jamais sentie aussi à l'aise pendant que quelqu'un me prenait en photo. J'ai même envie de recommencer. J'ai adoré. Merci, Patricia, d'avoir si bien capturé mon essence. Tu es incroyable.",
    },
  },
  {
    id: "4a3e723c-429d-41d3-934d-0c7aa9b62306",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Patricia não é uma fotógrafa qualquer. É uma artista que cria conceitos! Fiz uma sessão fotográfica com ela sobre masculinidade tóxica e mudou a forma como me via. Não foi apenas tirar fotos incríveis. A Patricia traz uma experiência imersiva quando nos fotografa. Foi maravilhoso conhecer uma pessoa tão boa e talentosa, e só posso recomendá-la!",
      de: "Patricia ist keine gewöhnliche Fotografin. Sie ist eine Künstlerin, die Konzepte erschafft! Ich hatte ein Fotoshooting mit ihr zum Thema toxische Männlichkeit, und es hat meine Selbstwahrnehmung verändert. Es ging nicht nur darum, unglaubliche Fotos zu machen. Patricia schafft beim Fotografieren ein immersives Erlebnis. Es war großartig, einen so guten und talentierten Menschen kennenzulernen, und ich kann sie nur empfehlen!",
      es: "Patricia no es una fotógrafa cualquiera. ¡Es una artista que crea conceptos! Hice una sesión con ella sobre masculinidad tóxica y cambió la forma en la que me veía. No fue solo hacer fotos increíbles. Patricia te ofrece una experiencia inmersiva cuando te fotografía. Fue maravilloso conocer a una persona tan buena y talentosa, ¡no puedo más que recomendarla!",
      fr: "Patricia n'est pas une photographe comme les autres. C'est une artiste qui crée des concepts ! J'ai fait avec elle une séance photo autour de la masculinité toxique, et cela a changé la façon dont je me regardais. Il ne s'agissait pas juste de faire des photos incroyables. Patricia offre une expérience immersive quand elle photographie. C'était formidable de rencontrer quelqu'un d'aussi bon et talentueux, je ne peux que la recommander !",
    },
  },
  {
    id: "9d733bd0-9ab3-4543-ae67-76d6e2a4dfc8",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Que experiência inesquecível!\nA Patricia e o Fernando sabem mesmo como nos pôr à vontade, especialmente quando estamos sozinhos em frente a uma câmara. Às vezes não é fácil largarmo-nos, mas com eles acredito que tudo é possível, porque tornam toda a experiência única, e o tempo voa tão depressa que, quando damos por isso, a sessão já acabou e queremos continuar 🤭\nAinda não tenho palavras para descrever de verdade o que sinto quando olho para as minhas fotos da Phoenix... Estava a passar por uma das piores fases da minha vida, a sair de uma relação tóxica que durou quase treze anos, e sinto que esta sessão foi como uma libertação para mim, em que verdadeiramente me transformei e renasci das cinzas — e por isso me sinto uma pessoa nova e voo livre.\nO tema da sessão era intenso e pesado, mas com a ajuda deles tudo fluiu na perfeição.\nQuero agradecer aos profissionais por também acreditarem no meu potencial e por tornarem tudo tão leve quando carregamos o caos no coração 💜\nComo já te disse, o teu trabalho tocou-me a alma desde o início e agora estamos em constante evolução 🦋\nSe estás a pensar em fazer uma sessão sozinha ou acompanhada, não penses duas vezes — entra em contacto, porque não te vais arrepender 🤞🏻",
      de: "Was für eine unvergessliche Erfahrung!\nPatricia und Fernando wissen wirklich, wie sie einen entspannen lassen — gerade, wenn man allein vor der Kamera ist. Manchmal ist es nicht leicht, sich gehen zu lassen, aber mit ihnen ist alles möglich, weil sie das ganze Erlebnis einzigartig machen und die Zeit so schnell vergeht, dass die Session schon vorbei ist, bevor man es merkt — und man möchte einfach weitermachen 🤭\nIch habe noch immer keine Worte, um wirklich zu beschreiben, was ich fühle, wenn ich meine Phoenix-Fotos ansehe... Ich steckte gerade in einer der schwierigsten Phasen meines Lebens, kam aus einer toxischen Beziehung, die fast dreizehn Jahre gedauert hatte, und ich habe das Gefühl, dass diese Session für mich wie eine Befreiung war: Ich habe mich wirklich verwandelt und bin aus der Asche aufgestiegen — und deshalb fühle ich mich wie ein neuer Mensch und fliege frei.\nDas Thema der Session war intensiv und schwer, aber mit ihrer Hilfe ist alles wunderbar geflossen.\nIch möchte den Profis danken, dass sie an mein Potenzial geglaubt und alles so leicht gemacht haben, wenn man Chaos im Herzen trägt 💜\nWie ich dir bereits gesagt habe, hat deine Arbeit von Anfang an meine Seele berührt, und jetzt entwickeln wir uns gemeinsam weiter 🦋\nWenn du darüber nachdenkst, ein Shooting allein oder zu zweit zu machen, denk nicht lange nach — meld dich, du wirst es bestimmt nicht bereuen 🤞🏻",
      es: "¡Qué experiencia inolvidable!\nPatricia y Fernando saben de verdad cómo ponerte cómoda, sobre todo cuando estás sola frente a la cámara. A veces no es fácil soltarse, pero con ellos creo que todo es posible, porque hacen que toda la experiencia sea única, y el tiempo vuela tan deprisa que cuando te das cuenta la sesión ya ha terminado y quieres seguir 🤭\nTodavía no tengo palabras para describir de verdad lo que siento cuando miro mis fotos de Phoenix... Estaba pasando por una de las peores fases de mi vida, saliendo de una relación tóxica que duró casi trece años, y siento que esta sesión fue como una liberación para mí, en la que realmente me transformé y resurgí de las cenizas — por eso me siento una persona nueva y vuelo libre.\nEl tema de la sesión era intenso y pesado, pero con su ayuda todo fluyó a la perfección.\nQuiero agradecer a los profesionales por creer también en mi potencial y por hacer que todo fuera tan ligero cuando llevamos el caos en el corazón 💜\nComo ya te dije, vuestro trabajo me tocó el alma desde el principio y ahora estamos en evolución constante 🦋\nSi estás pensando en hacer una sesión sola o acompañada, no lo pienses dos veces, contáctanos, porque de verdad no te vas a arrepentir 🤞🏻",
      fr: "Quelle expérience inoubliable !\nPatricia et Fernando savent vraiment comment vous mettre à l'aise, surtout quand on est seul·e devant un objectif. Ce n'est pas toujours facile de se lâcher, mais avec eux je crois que tout est possible, parce qu'ils rendent toute l'expérience unique, et le temps file tellement vite que, quand on s'en rend compte, la séance est déjà finie et on a envie de continuer 🤭\nJe n'ai toujours pas les mots pour décrire vraiment ce que je ressens en regardant mes photos de Phoenix... Je traversais l'une des pires phases de ma vie, sortant d'une relation toxique qui avait duré près de treize ans, et je sens que cette séance a été pour moi comme une libération, où je me suis réellement transformée et où je suis renée de mes cendres — c'est pour ça que je me sens une personne nouvelle et que je vole librement.\nLe thème de la séance était intense et lourd, mais avec leur aide tout s'est parfaitement enchaîné.\nJe tiens à remercier ces professionnels d'avoir cru en mon potentiel et d'avoir rendu tout cela si léger quand on porte du chaos dans le cœur 💜\nComme je te l'ai déjà dit, votre travail m'a touchée au plus profond dès le début, et maintenant nous évoluons constamment ensemble 🦋\nSi tu hésites à faire une séance seule ou accompagnée, ne réfléchis pas deux fois, contacte-les, parce que tu ne le regretteras vraiment pas 🤞🏻",
    },
  },
  {
    id: "f21ce394-83d3-45ea-8f3b-5af9550dce80",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Em 2019 tivemos uma sessão fotográfica de casal que adorámos. Foi a melhor experiência que tivemos nesta área.\nEste ano repetimos, mas com o nosso bebé. Foi ainda melhor. O ambiente descontraído e o profissionalismo ajudam tudo a correr bem. As fotos captam os detalhes de forma incrível e transmitem mesmo aquilo que as palavras não conseguem.\nVamos repetir, sem dúvida. Recomendo sem hesitar.",
      de: "2019 hatten wir ein Paar-Shooting, das wir geliebt haben. Es war die beste Erfahrung, die wir in diesem Bereich gemacht hatten.\nDieses Jahr haben wir es wiederholt, diesmal mit unserem Baby. Es war noch besser. Die entspannte Atmosphäre und die Professionalität sorgen dafür, dass alles reibungslos läuft. Die Fotos fangen die Details auf unglaubliche Weise ein und transportieren genau das, was Worte nicht ausdrücken können.\nWir werden es ganz sicher wiederholen. Ich empfehle es ohne zu zögern.",
      es: "En 2019 hicimos una sesión de pareja que nos encantó. Fue la mejor experiencia que habíamos tenido en este campo.\nEste año la repetimos, pero con nuestro bebé. Fue aún mejor. El ambiente relajado y la profesionalidad hacen que todo fluya. Las fotos captan los detalles de una forma increíble y transmiten justo lo que las palabras no pueden.\nLo repetiremos, sin duda. Lo recomiendo sin pensarlo.",
      fr: "En 2019, nous avons fait une séance photo de couple que nous avons adorée. C'était la meilleure expérience que nous avions eue dans ce domaine.\nCette année, nous l'avons refaite, mais avec notre bébé. C'était encore mieux. L'ambiance détendue et le professionnalisme permettent à tout de bien se dérouler. Les photos capturent les détails de manière incroyable et transmettent vraiment ce que les mots ne peuvent pas dire.\nNous le referons sans hésiter. Je recommande sans aucun doute.",
    },
  },
  {
    id: "2be43faa-ba2c-420e-a89c-a85613f48f01",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Não há palavras para descrever o trabalho feito e entregue.\nUma sessão de casal pré-parto que se transformou numa tarde de imensos sorrisos.\nA Mónica tem a capacidade de nos deixar tão à vontade que nem parece que temos uma câmara à frente.\nE as fotos ficaram ainda melhores do que esperávamos!\nFoi uma experiência incrível que queremos mesmo repetir.\n🙏1",
      de: "Es gibt keine Worte, um die Arbeit zu beschreiben, die geleistet und geliefert wurde.\nEin Paar-Shooting vor der Geburt, das sich in einen Nachmittag voller Lächeln verwandelt hat.\nMónica schafft es, dass man sich so wohlfühlt, dass es überhaupt nicht so wirkt, als hätte man eine Kamera vor sich.\nUnd die Fotos sind sogar noch besser geworden, als wir erwartet hatten!\nEine unglaubliche Erfahrung, die wir unbedingt wiederholen möchten.\n🙏1",
      es: "No hay palabras para describir el trabajo que se ha hecho y entregado.\nUna sesión de pareja prenacimiento que se transformó en una tarde de muchísimas sonrisas.\nMónica tiene la capacidad de hacerte sentir tan cómoda que ni parece que tienes una cámara delante.\n¡Y las fotos quedaron incluso mejor de lo que esperábamos!\nFue una experiencia increíble que tenemos muchas ganas de repetir.\n🙏1",
      fr: "Il n'y a pas de mots pour décrire le travail réalisé et livré.\nUne séance de couple avant la naissance qui s'est transformée en un après-midi plein de sourires.\nMónica a la capacité de nous mettre tellement à l'aise qu'on a l'impression de ne même pas avoir un appareil photo en face.\nEt les photos sont encore plus belles que ce que nous attendions !\nUne expérience incroyable que nous avons vraiment envie de refaire.\n🙏1",
    },
  },
  {
    id: "80afee63-72eb-4de6-a5b9-c818d9993c32",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos o trabalho do Canto da Objectiva no nosso casamento.\nA Mónica fez-nos sentir muito à vontade durante a sessão fotográfica e a sua dedicação foi incansável do início ao fim — não só durante a festa, mas também depois, na entrega das fotos.\nRecomendo vivamente a quem procura fotógrafos para uma ocasião muito especial.\n🙏1",
      de: "Wir haben die Arbeit von Canto da Objectiva bei unserer Hochzeit geliebt.\nMónica hat dafür gesorgt, dass wir uns beim Shooting wirklich wohlfühlen, und ihr Einsatz war von Anfang bis Ende unermüdlich — nicht nur während der Feier, sondern auch danach, bei der Übergabe der Fotos.\nIch kann sie wärmstens empfehlen, wenn man Fotografen für einen ganz besonderen Anlass sucht.\n🙏1",
      es: "Nos encantó el trabajo de Canto da Objectiva en nuestra boda.\nMónica nos hizo sentir muy cómodos durante la sesión y su dedicación fue incansable de principio a fin, no solo durante la fiesta sino también después, en la entrega de las fotos.\nRecomiendo muchísimo a quien busque fotógrafos para una ocasión muy especial.\n🙏1",
      fr: "Nous avons adoré le travail de Canto da Objectiva à notre mariage.\nMónica nous a mis très à l'aise pendant la séance photo, et son dévouement a été infatigable du début à la fin — pas seulement pendant la fête, mais aussi après, lors de la livraison des photos.\nJe recommande vivement à toute personne qui cherche des photographes pour une occasion très spéciale.\n🙏1",
    },
  },
  {
    id: "b376e42e-219a-4cb9-b175-ff81865fc83c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fotos incríveis!!\nNão podíamos ter escolhido melhor fotógrafa!\nA Mónica conseguiu captar o melhor não só dos noivos, mas também de todos os convidados (cerca de 60).\nFez-nos sempre sentir confortáveis e dava sugestões sem forçar poses ao longo do evento.\nTeve sempre uma grande sensibilidade aos pequenos detalhes, e o resultado são as fotografias maravilhosas para as quais olhamos hoje com muito carinho.\nUm serviço de 5 estrelas que recomendo vivamente, não só pelo apoio ao longo do dia, mas também pelo cuidado, dedicação e carinho na edição das fotografias.\n🙏1",
      de: "Unglaubliche Fotos!!\nWir hätten keine bessere Fotografin wählen können!\nMónica hat es geschafft, nicht nur das Brautpaar, sondern auch alle Gäste (etwa 60) im besten Licht festzuhalten.\nSie hat uns immer wohlfühlen lassen und während des gesamten Events Vorschläge gemacht, ohne Posen zu erzwingen.\nSie hatte stets ein großes Gespür für die kleinen Details, und das Ergebnis sind diese wunderschönen Fotos, die wir heute mit viel Liebe ansehen.\nEin 5-Sterne-Service, den ich sehr empfehle — nicht nur für die Begleitung am Tag selbst, sondern auch für die Sorgfalt, Hingabe und Liebe bei der Bearbeitung der Fotos.\n🙏1",
      es: "¡¡Fotos increíbles!!\n¡No podríamos haber elegido mejor fotógrafa!\nMónica consiguió captar lo mejor no solo de los novios sino también de todos los invitados (alrededor de 60).\nNos hizo sentir siempre cómodos y daba sugerencias sin forzar las poses durante todo el evento.\nSiempre tuvo una gran sensibilidad para los pequeños detalles, y el resultado son las maravillosas fotos que hoy miramos con muchísimo cariño.\nUn servicio 5 estrellas que recomiendo muchísimo, no solo por el apoyo durante todo el día sino también por el cuidado, dedicación y cariño en la edición de las fotos.\n🙏1",
      fr: "Des photos incroyables !!\nNous n'aurions pas pu choisir meilleure photographe !\nMónica a réussi à capturer le meilleur non seulement des mariés, mais aussi de tous les invités (environ 60).\nElle nous a toujours mis à l'aise et donnait des suggestions sans forcer les poses tout au long de la journée.\nElle a toujours eu une grande sensibilité aux petits détails, et le résultat ce sont ces magnifiques photos que nous regardons aujourd'hui avec beaucoup de tendresse.\nUn service 5 étoiles que je recommande vivement, non seulement pour l'accompagnement tout au long de la journée mais aussi pour le soin, le dévouement et l'affection dans la retouche des photos.\n🙏1",
    },
  },
  {
    id: "d7e10067-d963-47bc-8d3d-5bc65598e4c1",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Super simpáticos e prestáveis! Esta equipa é a melhor opção para captar momentos em fotografia!\nA Mónica foi a fotógrafa que trabalhou connosco e sabemos como isso é desafiante com crianças! Foi sempre carinhosa, atenta e soube captar momentos sem impor poses ou pôr pressão. As sessões fluíram como se estivéssemos a passear ou a tomar café com amigos. A minha menina ainda pergunta quando voltamos a ver a Mónica.\nDe casamentos a batizados, aniversários, sessões de família — qualquer que seja o momento, o canto da objetiva é o clique perfeito! Para além de captarem os momentos de forma natural, são rápidos a entregar o portefólio criado!\nObrigada a esta equipa maravilhosa!\n🙏1",
      de: "Super freundlich und hilfsbereit! Dieses Team ist die beste Wahl, um Momente in Bildern festzuhalten!\nMónica war die Fotografin, die mit uns gearbeitet hat, und wir wissen, wie herausfordernd das mit Kindern ist! Sie war immer liebevoll, aufmerksam und wusste, wie man Momente einfängt, ohne Posen aufzuzwingen oder Druck auszuüben. Die Sessions sind geflossen, als wären wir spazieren gegangen oder hätten mit Freunden Kaffee getrunken. Mein kleines Mädchen fragt heute noch, wann wir Mónica wiedersehen.\nVon Hochzeiten über Taufen, Geburtstage und Familien-Sessions bis hin zu allem dazwischen — was auch immer der Moment ist, „Canto da Objectiva\" ist der perfekte Klick! Sie fangen die Momente nicht nur natürlich ein, sondern liefern das fertige Portfolio auch noch sehr schnell!\nDanke an dieses wunderbare Team!\n🙏1",
      es: "¡Súper simpáticos y atentos! ¡Este equipo es la mejor opción para capturar momentos en fotografía!\n¡Mónica fue la fotógrafa que trabajó con nosotros, y sabemos lo desafiante que es con niños! Siempre fue cariñosa, atenta y supo captar momentos sin imponer poses ni meter presión. Las sesiones fluyeron como si estuviéramos paseando o tomando café con amigos. Mi pequeña todavía pregunta cuándo volvemos a ver a Mónica.\nDe bodas a bautizos, cumpleaños, sesiones familiares, sea cual sea el momento, el canto da objetiva es el clic perfecto. ¡Además de captar los momentos de forma natural, son rapidísimos en la entrega del portfolio!\n¡Gracias a este equipo maravilloso!\n🙏1",
      fr: "Super sympas et serviables ! Cette équipe est le meilleur choix pour capturer des moments en photo !\nMónica était la photographe qui a travaillé avec nous, et on sait à quel point c'est un défi avec des enfants ! Elle a toujours été tendre, attentive et a su saisir les moments sans imposer de poses ni mettre la pression. Les séances se sont déroulées comme si nous nous promenions ou prenions un café entre amis. Ma petite demande encore quand on revoit Mónica.\nDes mariages aux baptêmes, anniversaires, séances de famille, quel que soit le moment, canto da objectiva, c'est le clic parfait ! En plus de capturer les moments de manière naturelle, ils sont très rapides dans la livraison du portfolio !\nMerci à cette équipe merveilleuse !\n🙏1",
    },
  },
  {
    id: "9cd067ba-f1a5-4c22-9c78-b09ade16a703",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Já tive várias sessões individuais e adorei todas. Tudo é pensado ao detalhe, do local e roupa ao ambiente envolvente — tudo.\nSimpatia, profissionalismo, dedicação, cuidado e criatividade fazem parte do Canto da Objetiva ☺️\nRecomendo muito!!! Apaixonei-me pelos resultados finais.\n🙏1",
      de: "Ich hatte schon mehrere Einzelsessions und habe sie alle geliebt. Alles ist bis ins Detail durchdacht — vom Ort über die Kleidung bis zur Umgebung, einfach alles.\nFreundlichkeit, Professionalität, Engagement, Sorgfalt und Kreativität gehören zu Canto da Objetiva einfach dazu ☺️\nIch kann es sehr empfehlen!!! Ich habe mich in die Endergebnisse verliebt.\n🙏1",
      es: "He hecho varias sesiones individuales y me han encantado todas. Todo está pensado al detalle, desde el lugar y la ropa hasta el entorno — todo.\nLa simpatía, la profesionalidad, la dedicación, el cuidado y la creatividad forman parte de Canto da Objetiva ☺️\n¡¡Lo recomiendo muchísimo!! Me enamoré de los resultados finales.\n🙏1",
      fr: "J'ai déjà fait plusieurs séances individuelles et j'ai adoré chacune d'elles. Tout est pensé dans le détail, du lieu aux tenues en passant par l'environnement, tout.\nLa gentillesse, le professionnalisme, le dévouement, le soin et la créativité font partie de l'ADN de Canto da Objetiva ☺️\nJe recommande vraiment !!! Je suis tombée amoureuse des résultats finaux.\n🙏1",
    },
  },
  {
    id: "fba9e733-a284-454a-9251-3df44cd82567",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A sessão fotográfica com a Sophie foi simplesmente mágica.\nA Sophie esforçou-se imenso para acolher todos os meus desejos.\nO resultado também é lindo.\nEstou encantada e marcaria outra sessão.",
      de: "Das Fotoshooting mit Sophie war einfach magisch.\nSophie hat sich unglaublich Mühe gegeben, alle meine Wünsche zu erfüllen.\nDas Ergebnis ist ebenfalls wunderschön.\nIch bin begeistert und würde sofort ein weiteres Shooting buchen.",
      es: "La sesión fotográfica con Sophie fue simplemente mágica.\nSophie se esforzó muchísimo para atender todos mis deseos.\nEl resultado también es precioso.\nEstoy encantada y reservaría otra sesión.",
      fr: "La séance photo avec Sophie a été tout simplement magique.\nSophie s'est démenée pour répondre à tous mes souhaits.\nLe résultat est également magnifique.\nJe suis ravie et je referais sans hésiter une autre séance.",
    },
  },
  {
    id: "7668d6a1-e732-4e71-8775-877048e9780f",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma ótima experiência com a Tatiana e as minhas fotos ficaram incríveis. A Tatiana fez-me ficar tão bonita! Recomendo muito esta experiência!",
      de: "Ich hatte eine tolle Erfahrung mit Tatiana und meine Fotos sind unglaublich geworden. Tatiana hat mich so hübsch aussehen lassen! Ich empfehle dieses Erlebnis sehr!",
      es: "Tuve una experiencia increíble con Tatiana y mis fotos quedaron espectaculares. ¡Tatiana hizo que me viera súper guapa! ¡Recomiendo muchísimo esta experiencia!",
      fr: "J'ai vécu une super expérience avec Tatiana et mes photos sont incroyables. Tatiana m'a fait paraître si jolie ! Je recommande vivement cette expérience !",
    },
  },
  {
    id: "f4f9d120-1346-45e8-8820-3c27197ca331",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Imperdível em Lisboa! A Tatiana foi muito simpática e esperou por mim depois de eu ter perdido a minha mala num táxi. Adorei o café para onde me levou e adorei as fotos que tirou de mim. Senti-me um pouco desajeitada no início, mas a Tatiana foi super prestável e mostrou-me como posar.",
      de: "Ein Muss in Lissabon! Tatiana war sehr freundlich und hat auf mich gewartet, nachdem ich meine Tasche im Taxi verloren hatte. Das Café, in das sie mich mitgenommen hat, hat mir richtig gut gefallen, und meine Fotos liebe ich. Anfangs war es mir etwas unangenehm, aber Tatiana war super hilfsbereit und hat mir gezeigt, wie ich mich hinstellen soll.",
      es: "¡Imprescindible en Lisboa! Tatiana fue muy amable y me esperó después de que perdiera mi bolso en un taxi. Me encantó el café al que me llevó y me encantaron las fotos que me hizo. Al principio me sentí algo torpe, pero Tatiana fue súper atenta y me enseñó a posar.",
      fr: "Un incontournable à Lisbonne ! Tatiana a été très gentille et m'a attendue après que j'ai perdu mon sac dans un taxi. J'ai adoré le café où elle m'a emmenée et j'ai adoré les photos qu'elle a prises de moi. Au début, je me sentais un peu maladroite, mais Tatiana a été super serviable et m'a montré comment poser.",
    },
  },
  {
    id: "896fe702-6098-4fc2-8cbd-6c6f438d5173",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Adorámos a sessão. A Isa é uma pessoa muito profissional, dedicada e super descontraída. Acabou por ser um momento muito agradável! Escolhemos a pessoa certa para fotografar este momento tão especial. Recomendo 5*",
      de: "Wir haben das Shooting geliebt. Isa ist sehr professionell, engagiert und super entspannt. Es ist ein wirklich angenehmer Moment geworden! Wir haben die richtige Person gewählt, um diesen ganz besonderen Moment festzuhalten. 5* — sehr zu empfehlen.",
      es: "Nos encantó la sesión. Isa es una persona muy profesional, dedicada y súper relajada. Acabó siendo un momento muy agradable. Elegimos a la persona adecuada para fotografiar este momento tan especial. ¡La recomiendo con 5*!",
      fr: "Nous avons adoré la séance. Isa est une personne très professionnelle, dévouée et super décontractée. Cela a été un moment très agréable ! Nous avons choisi la bonne personne pour photographier ce moment si spécial. Je recommande 5* !",
    },
  },
  {
    id: "368bb00e-6390-469e-9c49-e2175efd6e72",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ser fotografada pela Isa foi muito fácil e muito gratificante. Fizemos a nossa sessão de Natal/Maternidade e adorámos. A Isa é uma excelente profissional, faz-nos sentir super à vontade e é muito simpática. As fotos chegam muito rapidamente e a qualidade é espetacular. Adorámos, recomendamos e esperamos voltar a ver a Isa em breve.",
      de: "Von Isa fotografiert zu werden, war sehr einfach und sehr bereichernd. Wir hatten unsere Weihnachts-/Babybauch-Session und haben sie geliebt. Isa ist eine hervorragende Profi, sie sorgt dafür, dass man sich super wohlfühlt, und ist sehr freundlich. Die Fotos kommen sehr schnell und die Qualität ist spektakulär. Wir haben es geliebt, wir empfehlen sie weiter und freuen uns darauf, Isa bald wiederzusehen.",
      es: "Que Isa nos fotografíe fue muy fácil y muy gratificante. Hicimos nuestra sesión de Navidad/Maternidad y nos encantó. Isa es una excelente profesional, te hace sentir súper cómoda y es muy maja. Las fotos llegan muy rápido y la calidad es espectacular. Nos encantó, la recomendamos y esperamos volver a ver a Isa muy pronto.",
      fr: "Se faire photographier par Isa a été très facile et très gratifiant. Nous avons fait notre séance Noël/grossesse et nous avons adoré. Isa est une excellente professionnelle, elle vous met super à l'aise et est très sympathique. Les photos arrivent très vite et la qualité est spectaculaire. Nous avons adoré, nous la recommandons et nous espérons revoir Isa très bientôt.",
    },
  },
  {
    id: "9c13d22f-0a58-4210-aa86-28e276c45f98",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Ótimo trabalho — excelente profissional, muito responsável, super agradável, acessível, mega simpática, trabalho de 5 estrelas! Recomendo a 100%. Obrigada Isa.",
      de: "Tolle Arbeit — hervorragende Profi, sehr verantwortungsbewusst, super angenehm, unkompliziert, mega sympathisch, 5-Sterne-Arbeit! Ich empfehle sie zu 100 %. Danke, Isa.",
      es: "¡Genial trabajo — excelente profesional, muy responsable, súper agradable, cercana, mega simpática, trabajo de 5 estrellas! La recomiendo al 100%. Gracias Isa.",
      fr: "Super travail — excellente professionnelle, très responsable, super agréable, accessible, méga sympathique, du travail 5 étoiles ! Je recommande à 100 %. Merci Isa.",
    },
  },
  {
    id: "2e5c6022-e1f8-4d2f-97df-d3e337bce39b",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Se houvesse 10 estrelas, dava-as todas! A Chris é a melhor fotógrafa que vais encontrar. A que te faz sentir super à vontade, a que repara nos detalhes como se os visse pelos teus olhos, a que te orienta em cada pose, a que te desafia a cada clique e a que tenta genuinamente perceber a tua história e o caminho que queres seguir, traduzindo isso numa narrativa fotográfica incrível. Se procuras uma fotógrafa com uma abordagem humana e profissional, a Chris é a escolha certa! Obrigada, Chris ❤️",
      de: "Wenn es 10 Sterne gäbe, würde ich sie alle vergeben! Chris ist die beste Fotografin, die du finden kannst. Sie ist diejenige, die dich richtig wohlfühlen lässt, die die Details wahrnimmt, als sähe sie sie durch deine Augen, die dich bei jeder Pose anleitet, die dich mit jedem Klick herausfordert und die ehrlich versucht, deine Geschichte und den Weg zu verstehen, den du gehen willst — und das in eine unglaubliche fotografische Erzählung übersetzt. Wenn du eine Fotografin mit einem menschlichen und professionellen Ansatz suchst, ist Chris die richtige Wahl! Danke, Chris ❤️",
      es: "¡Si hubiera 10 estrellas, las daría todas! Chris es la mejor fotógrafa que vas a encontrar. La que te hace sentir súper cómoda, la que se fija en los detalles como si los viera a través de tus ojos, la que te guía en cada pose, la que te reta con cada clic y la que intenta entender de verdad tu historia y el camino que quieres seguir, traduciéndolo en una narrativa fotográfica increíble. Si buscas una fotógrafa con un enfoque humano y profesional, ¡Chris es la elección correcta! Gracias, Chris ❤️",
      fr: "S'il y avait 10 étoiles, je les donnerais toutes ! Chris est la meilleure photographe que tu puisses trouver. Celle qui te met super à l'aise, celle qui remarque les détails comme si elle les voyait avec tes yeux, celle qui te guide dans chaque pose, celle qui te défie à chaque clic et celle qui cherche sincèrement à comprendre ton histoire et le chemin que tu veux prendre, en le traduisant dans un récit photographique incroyable. Si tu cherches une photographe à l'approche humaine et professionnelle, Chris est le bon choix ! Merci, Chris ❤️",
    },
  },
  {
    id: "fb71b33d-0c9d-4559-94bd-53ca9b45e04b",
    title: {
      pt: "Trabalho perfeito",
      de: "Perfekte Arbeit",
      es: "Trabajo perfecto",
      fr: "Un travail parfait",
    },
    text: {
      pt: "Sem palavras para o trabalho incrível e magnífico desta profissional! Tudo foi perfeito! A Jennifer sabe captar cada detalhe e mostrar o amor presente em cada momento do dia! Sem dúvida, a melhor profissional que poderíamos ter escolhido para o nosso grande dia!",
      de: "Keine Worte für die unglaubliche und großartige Arbeit dieser Profi! Alles war perfekt! Jennifer versteht es, jedes Detail einzufangen und die Liebe sichtbar zu machen, die in jedem Moment des Tages steckt! Ohne Zweifel die beste Wahl, die wir für unseren großen Tag treffen konnten!",
      es: "¡No hay palabras para describir el trabajo increíble y magnífico de esta profesional! ¡Todo fue perfecto! ¡Jennifer sabe captar cada detalle y mostrar el amor presente en cada momento del día! ¡Sin duda, la mejor profesional que podíamos haber elegido para nuestro gran día!",
      fr: "Pas de mots pour le travail incroyable et magnifique de cette professionnelle ! Tout a été parfait ! Jennifer sait capturer chaque détail et montrer l'amour présent dans chaque moment de la journée ! Sans aucun doute la meilleure professionnelle que nous aurions pu choisir pour notre grand jour !",
    },
  },
  {
    id: "09e569ec-e40e-4591-ba2e-0444092b1296",
    title: {
      pt: "Uma fotógrafa de ouro",
      de: "Eine goldene Fotografin",
      es: "Una fotógrafa de oro",
      fr: "Une photographe en or",
    },
    text: {
      pt: "Sem dúvida a melhor. Já tivemos a oportunidade de trabalhar com ela antes e não nos arrependemos da escolha — profissional, talentosa, calma, compreensiva, uma joia de pessoa.",
      de: "Ohne Zweifel die Beste. Wir hatten schon die Gelegenheit, mit ihr zu arbeiten, und bereuen unsere Wahl nicht — professionell, talentiert, ruhig, verständnisvoll, ein wunderbarer Mensch.",
      es: "Sin duda la mejor. Ya tuvimos la oportunidad de trabajar con ella antes y no nos arrepentimos de la elección — profesional, con talento, tranquila, comprensiva, una joya de persona.",
      fr: "Sans aucun doute la meilleure. Nous avons déjà eu la chance de travailler avec elle, et nous ne regrettons pas notre choix — professionnelle, talentueuse, calme, compréhensive, un véritable joyau.",
    },
  },
  {
    id: "3134fac9-60b6-45b5-ae05-ce7b62240272",
    title: {
      pt: "Rápidos, flexíveis e uma equipa adorável",
      de: "Schnell, flexibel und ein wunderbares Team",
      es: "Rápidos, flexibles y un equipo encantador",
      fr: "Rapides, flexibles et une équipe adorable",
    },
    text: {
      pt: "Estilo fotográfico simples e elegante, equipa simpática e bem organizada — vale cada cêntimo!",
      de: "Schlichter und eleganter Fotostil, ein freundliches und gut organisiertes Team — jeden Cent wert!",
      es: "Estilo fotográfico sencillo y elegante, equipo amable y bien organizado — ¡vale cada céntimo!",
      fr: "Style photographique simple et élégant, équipe sympathique et bien organisée — vaut chaque centime !",
    },
  },
  {
    id: "beeaec63-6a7f-4387-9202-14a6bf4da610",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O Rui mostrou-se um profissional exemplar desde o primeiro contacto até ao resultado final. Sempre disposto a ajudar e a contornar os obstáculos sempre que surgia algum. Para além disso, foi alguém que criou um bom ambiente, não só entre os fornecedores, mas até com os convidados, deixando-nos à vontade para que as fotos tivessem o resultado mais natural possível. Adorámos o seu trabalho no nosso casamento e é, sem dúvida, um fornecedor que recomendamos a quem procura um fotógrafo de elevada qualidade para registar um dia especial. 5 estrelas! Obrigado, Rui.",
      de: "Rui hat sich vom ersten Kontakt bis zum Endergebnis als vorbildlicher Profi erwiesen. Immer bereit zu helfen und Hindernisse zu meistern, sobald welche auftauchten. Außerdem hat er für eine tolle Stimmung gesorgt — nicht nur unter den Dienstleistern, sondern auch bei den Gästen — und uns entspannt sein lassen, damit die Fotos möglichst natürlich werden. Wir haben seine Arbeit auf unserer Hochzeit geliebt, und er ist ohne Zweifel ein Dienstleister, den wir allen empfehlen, die einen hochwertigen Fotografen für einen besonderen Tag suchen. 5 Sterne! Danke, Rui.",
      es: "Rui demostró ser un profesional ejemplar desde el primer contacto hasta el resultado final. Siempre dispuesto a ayudar y a superar los obstáculos cuando surgían. Además, fue alguien que creó un buen ambiente no solo entre los proveedores sino también con los invitados, dejándonos cómodos para que las fotos tuvieran el resultado más natural posible. Nos encantó su trabajo en nuestra boda y es, sin duda, un proveedor que recomendamos a quien busca un fotógrafo de alta calidad para registrar un día especial. ¡5 estrellas! Gracias, Rui.",
      fr: "Rui s'est montré un professionnel exemplaire dès le premier contact jusqu'au résultat final. Toujours prêt à aider et à contourner les obstacles dès qu'ils se présentaient. En plus, il a créé une excellente ambiance, non seulement entre les prestataires mais aussi avec les invités, en nous mettant à l'aise pour que les photos soient le plus naturelles possible. Nous avons adoré son travail à notre mariage et c'est sans aucun doute un prestataire que nous recommandons à toute personne cherchant un photographe de très grande qualité pour immortaliser un jour spécial. 5 étoiles ! Merci, Rui.",
    },
  },
  {
    id: "c9934b1c-31b4-4127-a332-d3b8c8ca0c0c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Rui, não conhecia o teu trabalho e fiquei impressionada com a atenção, o cuidado e o carisma que demonstraste perante todos os convidados, e principalmente com o cuidado para com os noivos. Calmo, muito atento, prestativo — não podia ter escolhido melhor. Muito obrigada, Rui, pelo teu envolvimento nesta data tão importante para nós. Os noivos agradecem. Casal Esteves",
      de: "Rui, ich kannte deine Arbeit nicht und war beeindruckt von der Aufmerksamkeit, der Fürsorge und dem Charisma, das du allen Gästen gegenüber gezeigt hast, und vor allem von deiner Sorgfalt für das Brautpaar. Ruhig, sehr aufmerksam, hilfsbereit — wir hätten keine bessere Wahl treffen können. Vielen Dank, Rui, für dein Engagement an diesem für uns so wichtigen Tag. Das Brautpaar dankt dir. Familie Esteves",
      es: "Rui, no conocía tu trabajo y me dejaste impresionada por la atención, el cuidado y el carisma que mostraste con todos los invitados, y sobre todo con los novios. Tranquilo, muy atento, servicial — no podía haber elegido mejor. Muchísimas gracias, Rui, por tu implicación en una fecha tan importante para nosotros. Los novios te lo agradecen. Familia Esteves",
      fr: "Rui, je ne connaissais pas ton travail et j'ai été impressionnée par l'attention, le soin et le charisme dont tu as fait preuve avec tous les invités, et surtout avec les mariés. Calme, très attentif, serviable — je n'aurais pas pu mieux choisir. Merci infiniment, Rui, pour ton implication dans cette date si importante pour nous. Les mariés te remercient. Famille Esteves",
    },
  },
  {
    id: "1424c68d-8616-47ff-9289-3d0541315377",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Tive uma experiência incrível na sessão fotográfica em Lisboa com a Viktoriia! Foi muito profissional, conhecia os melhores locais da cidade e fez-me sentir à vontade em frente à câmara num instante. As suas dicas para posar foram super úteis, e garantiu que eu tivesse uma grande variedade de fotos e vídeos espetaculares para captar a beleza de Lisboa. A Viktoriia tem mesmo um olhar para o detalhe e sabe como tirar o melhor de cada plano. Voltava a marcar com ela sem hesitar para qualquer sessão futura — super recomendada!",
      de: "Ich hatte ein unglaubliches Foto-Shooting-Erlebnis in Lissabon mit Viktoriia! Sie war sehr professionell, kannte die besten Locations der Stadt und hat mir sofort das Gefühl gegeben, vor der Kamera entspannt zu sein. Ihre Pose-Tipps waren super hilfreich, und sie hat dafür gesorgt, dass ich eine große Vielfalt an tollen Fotos und Videos hatte, die die Schönheit Lissabons einfangen. Viktoriia hat wirklich einen Blick fürs Detail und weiß, wie man das Beste aus jeder Aufnahme herausholt. Ich würde sie jederzeit wieder buchen — absolute Empfehlung!",
      es: "¡Tuve una experiencia increíble en la sesión de fotos en Lisboa con Viktoriia! Fue muy profesional, conocía los mejores lugares de la ciudad y me hizo sentir cómoda delante de la cámara enseguida. Sus consejos para posar fueron súper útiles y se aseguró de que tuviera una gran variedad de fotos y vídeos espectaculares para captar la belleza de Lisboa. Viktoriia tiene de verdad un ojo para los detalles y sabe sacar lo mejor de cada toma. Volvería a reservar con ella sin dudarlo para cualquier sesión futura — ¡muy recomendable!",
      fr: "J'ai vécu une expérience incroyable lors de ma séance photo à Lisbonne avec Viktoriia ! Elle a été très professionnelle, connaissait les meilleurs endroits de la ville et m'a tout de suite mise à l'aise devant l'objectif. Ses conseils pour poser ont été super utiles et elle s'est assurée que j'aie une grande variété de magnifiques photos et vidéos pour capturer la beauté de Lisbonne. Viktoriia a vraiment l'œil pour les détails et sait tirer le meilleur de chaque plan. Je la rebookerais sans hésiter pour toute future séance — vivement recommandée !",
    },
  },
  {
    id: "d1e31daa-f0ce-4c6d-afd4-319f044fb06a",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Marquei uma sessão fotográfica com a Viktoriia para o meu 35.º aniversário e o resultado final superou todas as minhas expectativas! A Viktoriia é uma pessoa muito simpática e amigável, que nos põe imediatamente à vontade. Conhece os melhores locais e dá ótimas dicas sobre como posar e o que fazer. Não hesites — marca a experiência com ela. Obrigada mais uma vez!",
      de: "Ich habe ein Fotoshooting mit Viktoriia zu meinem 35. Geburtstag gebucht, und das Endergebnis hat alle meine Erwartungen übertroffen! Viktoriia ist eine sehr nette und freundliche Person, die einen sofort entspannen lässt. Sie kennt die besten Locations und gibt großartige Tipps für Posen und Bewegungen. Zögert nicht — bucht das Erlebnis bei ihr. Nochmals vielen Dank!",
      es: "Reservé una sesión de fotos con Viktoriia para mi 35 cumpleaños y el resultado final superó todas mis expectativas. Viktoriia es una persona muy maja y cercana, te pone cómoda enseguida. Conoce los mejores lugares y te da muy buenos consejos sobre cómo posar y qué hacer. No lo dudes, reserva la experiencia con ella. ¡Mil gracias otra vez!",
      fr: "J'ai réservé une séance photo avec Viktoriia pour mes 35 ans et le résultat final a dépassé toutes mes attentes ! Viktoriia est une personne très sympa et chaleureuse qui vous met tout de suite à l'aise. Elle connaît les meilleurs endroits et donne d'excellents conseils pour poser et bouger. N'hésitez pas, réservez l'expérience avec elle. Merci encore !",
    },
  },
  {
    id: "a9851325-c9f2-4cfe-8464-bbecec4cc099",
    title: {
      pt: "O nosso casamento",
      de: "Unsere Hochzeit",
      es: "Nuestra boda",
      fr: "Notre mariage",
    },
    text: {
      pt: "O trabalho da Jennifer foi incrível. Desde o primeiro contacto até à entrega das fotos, apoiou-nos com muito carinho e simpatia. Tem muitas ideias que adora partilhar, e o resultado foi sempre exatamente aquilo que queríamos. Como já lhe disse: ela merece tudo isto e muito mais! Recomendamos sem hesitar!",
      de: "Jennifers Arbeit war unglaublich. Vom ersten Kontakt bis zur Übergabe der Fotos hat sie uns mit viel Zuneigung und Freundlichkeit begleitet. Sie hat viele Ideen, die sie gerne teilt, und das Ergebnis war immer genau das, was wir wollten. Wie ich ihr schon gesagt habe — sie verdient all das und noch viel mehr! Wir empfehlen sie ohne zu zögern!",
      es: "El trabajo de Jennifer fue increíble. Desde el primer contacto hasta la entrega de las fotos, nos acompañó con muchísimo cariño y amabilidad. Tiene un montón de ideas que le encanta compartir, y el resultado fue siempre justo lo que queríamos. Como ya le he dicho: ¡se merece esto y mucho más! ¡La recomendamos sin dudarlo!",
      fr: "Le travail de Jennifer a été incroyable. Du premier contact à la livraison des photos, elle nous a accompagnés avec beaucoup d'attention et de gentillesse. Elle a plein d'idées qu'elle adore partager, et le résultat a toujours été exactement ce que nous voulions. Comme je le lui ai déjà dit — elle mérite tout cela et bien plus encore ! Nous la recommandons sans hésiter !",
    },
  },
  {
    id: "ab7e7447-168f-4391-beb3-5026bf50d699",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia é uma fotógrafa fantástica — não te vais arrepender de marcar com ela! Tem olho para locais e ângulos lindos e adorei mesmo a sessão. Até deixou o meu cão vir comigo, o que adorei. Mal posso esperar para ver as fotos!",
      de: "Viktoriia ist eine großartige Fotografin — du wirst es nicht bereuen, sie zu buchen! Sie hat einen Blick für schöne Locations und Perspektiven, und mein Shooting hat mir richtig viel Spaß gemacht. Sie hat sogar meinen Hund mitkommen lassen, was ich super fand. Ich kann es kaum erwarten, die Fotos zu sehen!",
      es: "¡Viktoriia es una fotógrafa increíble — no te arrepentirás de reservar con ella! Tiene ojo para los lugares y los ángulos bonitos, y me encantó mucho la sesión. Hasta dejó que llevara a mi perro, lo cual me hizo mucha ilusión. ¡No veo la hora de ver las fotos!",
      fr: "Viktoriia est une photographe incroyable — vous ne regretterez pas de réserver avec elle ! Elle a l'œil pour les beaux lieux et les bons angles, et j'ai vraiment adoré ma séance. Elle a même accepté que je vienne avec mon chien, ce que j'ai apprécié. J'ai hâte de voir le résultat !",
    },
  },
  {
    id: "4f83f0d4-e64e-4315-90c6-30fa968d50a7",
    title: {
      pt: "A escolha certa para eternizar o nosso dia",
      de: "Die richtige Wahl, um unseren Tag zu verewigen",
      es: "La elección correcta para inmortalizar nuestro día",
      fr: "Le bon choix pour immortaliser notre journée",
    },
    text: {
      pt: "Desde o início soubemos que a Jennifer seria a nossa (única) escolha, e quando recebemos as fotos tivemos a certeza absoluta. 😍\n\nEu e o meu marido não nos sentimos minimamente confortáveis em frente a uma câmara, mas a Jennifer conseguiu captar a nossa essência de forma tão natural que acabámos por nos sentir bonitos quando voltámos a olhar para o nosso dia. Cada foto tem uma magia especial — os momentos que vivemos, os que não vimos, os olhares que trocámos, as emoções que sentimos...\n\nO seu profissionalismo é impressionante! Deixou-nos aproveitar o nosso dia, captou tudo o que era importante (e mais!) e não falhou nada!\n\nComo fotógrafa, é difícil confiar num dia tão importante a outra pessoa, mas a Jennifer superou TODAS as nossas expectativas.\n\nSe pudesse escolher de novo, seria sempre ela. 💛",
      de: "Von Anfang an wussten wir, dass Jennifer unsere (einzige) Wahl sein würde, und als wir die Fotos erhalten haben, waren wir uns absolut sicher. 😍\n\nMein Mann und ich fühlen uns vor der Kamera überhaupt nicht wohl, aber Jennifer hat es geschafft, unsere Essenz so natürlich einzufangen, dass wir uns am Ende, als wir auf unseren Tag zurückblickten, schön fanden. Jedes Foto hat eine besondere Magie — die Momente, die wir erlebt haben, die, die wir nicht gesehen haben, die Blicke, die wir tauschten, die Gefühle, die wir hatten...\n\nIhre Professionalität ist beeindruckend! Sie hat uns unseren Tag genießen lassen, alles Wichtige (und mehr!) eingefangen und nichts ausgelassen!\n\nAls Fotografin selbst fällt es einem schwer, einen so wichtigen Tag jemand anderem anzuvertrauen, aber Jennifer hat ALLE unsere Erwartungen übertroffen.\n\nWenn ich noch einmal wählen müsste, wäre es immer wieder sie. 💛",
      es: "Desde el principio supimos que Jennifer sería nuestra (única) elección, y cuando recibimos las fotos lo tuvimos clarísimo. 😍\n\nMi marido y yo no nos sentimos cómodos ante una cámara, pero Jennifer consiguió captar nuestra esencia de una forma tan natural que acabamos sintiéndonos guapos cuando volvimos a mirar nuestro día. Cada foto tiene una magia especial: los momentos que vivimos, los que no vimos, las miradas que cruzamos, las emociones que sentimos...\n\n¡Su profesionalidad es impresionante! Nos dejó disfrutar de nuestro día, capturó todo lo importante (¡y más!) y no se le escapó nada.\n\nComo fotógrafa, cuesta confiar un día tan importante a otra persona, pero Jennifer superó TODAS nuestras expectativas.\n\nSi tuviera que elegir otra vez, sería siempre ella. 💛",
      fr: "Dès le début, nous avons su que Jennifer serait notre (seul) choix, et quand nous avons reçu les photos, nous en avons eu la certitude absolue. 😍\n\nMon mari et moi ne nous sentons pas à l'aise devant un objectif, mais Jennifer a réussi à capturer notre essence de manière si naturelle que nous nous sommes finalement trouvés beaux en revoyant notre journée. Chaque photo a une magie particulière — les moments que nous avons vécus, ceux que nous n'avons pas vus, les regards que nous avons échangés, les émotions que nous avons ressenties...\n\nSon professionnalisme est impressionnant ! Elle nous a laissé profiter de notre journée, a capturé tout ce qui était important (et plus encore !) et n'a rien manqué !\n\nEn tant que photographe moi-même, il peut être difficile de confier à quelqu'un d'autre un jour aussi important, mais Jennifer a dépassé TOUTES nos attentes.\n\nSi je devais choisir à nouveau, ce serait elle, à chaque fois. 💛",
    },
  },
  {
    id: "53a19a43-5079-4954-bf64-c836c3b4e763",
    title: {
      pt: "Trabalho excecional!",
      de: "Außergewöhnliche Arbeit!",
      es: "¡Trabajo excepcional!",
      fr: "Un travail exceptionnel !",
    },
    text: {
      pt: "Recomendamos vivamente a Jennifer para captar um casamento ou qualquer outro momento precioso! Apesar da distância entre França, onde vivemos, e Portugal, geriu toda a organização na perfeição, por isso não tivemos de nos preocupar com nada.\n\nFoi extremamente disponível e notavelmente profissional desde os nossos primeiros contactos. No dia do casamento, soube captar cada momento com uma sensibilidade e um talento incríveis. As fotos refletem na perfeição a emoção, a alegria e a beleza desse dia.\n\nMuito obrigada pelo teu trabalho excecional e pela tua simpatia, que tornaram esta experiência tão agradável. Graças a ti, vamos guardar estas memórias maravilhosas para o resto das nossas vidas!",
      de: "Wir empfehlen Jennifer wärmstens, um eine Hochzeit oder einen anderen kostbaren Moment festzuhalten! Trotz der Entfernung zwischen Frankreich, wo wir leben, und Portugal hat sie die gesamte Organisation perfekt gemanagt, sodass wir uns um nichts kümmern mussten.\n\nSie war von unseren ersten Nachrichten an extrem erreichbar und ausgesprochen professionell. Am Tag unserer Hochzeit hat sie jeden Moment mit unglaublicher Sensibilität und Begabung eingefangen. Ihre Fotos spiegeln die Emotionen, die Freude und die Schönheit dieses Tages perfekt wider.\n\nVielen Dank für deine außergewöhnliche Arbeit und deine Freundlichkeit, die diese Erfahrung so angenehm gemacht haben. Dank dir werden wir diese wunderbaren Erinnerungen für den Rest unseres Lebens bewahren!",
      es: "¡Recomendamos muchísimo a Jennifer para captar una boda o cualquier otro momento precioso! A pesar de la distancia entre Francia, donde vivimos, y Portugal, gestionó toda la organización a la perfección, así que no tuvimos que preocuparnos por nada.\n\nFue extremadamente accesible y muy profesional desde nuestros primeros contactos. El día de nuestra boda, supo captar cada momento con una sensibilidad y un talento increíbles. Sus fotos reflejan a la perfección la emoción, la alegría y la belleza de ese día.\n\nMuchísimas gracias por tu trabajo excepcional y por tu amabilidad, que hicieron que esta experiencia fuera tan agradable. ¡Gracias a ti, conservaremos estos preciosos recuerdos durante el resto de nuestras vidas!",
      fr: "Nous recommandons vivement Jennifer pour capturer un mariage ou tout autre moment précieux ! Malgré la distance entre la France, où nous vivons, et le Portugal, elle a parfaitement géré toute l'organisation, nous n'avons donc eu à nous soucier de rien.\n\nElle a été extrêmement disponible et remarquablement professionnelle dès nos premiers échanges. Le jour de notre mariage, elle a su capturer chaque moment avec une sensibilité et un talent incroyables. Ses photos reflètent parfaitement l'émotion, la joie et la beauté de ce jour.\n\nMerci infiniment pour ton travail exceptionnel et pour ta gentillesse, qui ont rendu cette expérience si agréable. Grâce à toi, nous garderons ces merveilleux souvenirs pour le reste de notre vie !",
    },
  },
  {
    id: "d0069f2c-ee10-4078-bc40-92759d6baa3c",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Viktoriia tem um talento especial para nos fazer sentir muito à vontade no que pode ser uma situação algo intimidante. Conseguiu tirar o melhor de mim e proporcionou-me uma ótima experiência.",
      de: "Viktoriia hat ein besonderes Talent dafür, dich in einer Situation, die durchaus einschüchternd sein kann, total entspannen zu lassen. Sie hat das Beste aus mir herausgeholt und mir eine großartige Erfahrung beschert.",
      es: "Viktoriia tiene un talento especial para hacerte sentir muy cómoda en lo que puede ser una situación algo intimidante. Sacó lo mejor de mí y me brindó una experiencia genial.",
      fr: "Viktoriia a un talent particulier pour vous mettre très à l'aise dans ce qui peut être une situation un peu intimidante. Elle a su faire ressortir le meilleur de moi et m'a offert une superbe expérience.",
    },
  },
  {
    id: "6a87cc51-bcc9-4c2c-8fe8-7e9bfa2eba48",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Trabalhar com a Viktoriia é maravilhoso — fez-me sentir confortável e à vontade a ser fotografada. Conhecia ótimos sítios para fotografias, tal como descrito na página da experiência, e teve o cuidado de obter ótimos planos com os elétricos. Recomendo muito esta experiência para fotos de alta qualidade com uma profissional!",
      de: "Mit Viktoriia zu arbeiten ist wunderbar — sie hat mir das Gefühl gegeben, mich entspannt fotografieren zu lassen. Sie kannte tolle Foto-Spots, genau wie auf der Erlebnis-Seite beschrieben, und hat darauf geachtet, schöne Aufnahmen mit den Straßenbahnen zu machen. Ich empfehle dieses Erlebnis sehr für hochwertige Fotos mit einer echten Profi!",
      es: "Trabajar con Viktoriia es maravilloso, me hizo sentir cómoda y relajada haciéndome fotos. Conocía sitios geniales para fotografiar, tal como aparece en la página de la experiencia, y se aseguró de conseguir buenos planos con los tranvías. ¡Recomiendo muchísimo esta experiencia para conseguir fotos de alta calidad con una pro!",
      fr: "Travailler avec Viktoriia est un vrai plaisir — elle m'a mise à l'aise et confortable devant l'objectif. Elle connaissait d'excellents spots photo, comme indiqué sur la page de l'expérience, et a pris soin d'obtenir de superbes clichés avec les tramways. Je recommande vivement cette expérience pour des photos de grande qualité avec une vraie pro !",
    },
  },
  {
    id: "7392aa39-2524-42a3-ae12-77990263f786",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Foi uma forma fantástica de explorar Lisboa e ficar com fotos maravilhosas! A Viktoriia foi muito simpática e fez disto uma experiência confortável. Foi a primeira vez que tive uma sessão fotográfica profissional. Não podia recomendar mais.",
      de: "Eine fantastische Art, Lissabon zu erkunden und dabei wunderschöne Fotos mitzunehmen! Viktoriia war sehr nett und hat dafür gesorgt, dass es ein entspanntes Erlebnis wurde. Es war mein erstes professionelles Shooting. Ich kann es nur empfehlen.",
      es: "¡Fue una forma fantástica de explorar Lisboa y conseguir unas fotos maravillosas! Viktoriia fue muy amable y convirtió esto en una experiencia muy cómoda. Fue mi primera sesión de fotos profesional. No podía recomendarlo más.",
      fr: "Une façon fantastique d'explorer Lisbonne tout en obtenant de superbes photos ! Viktoriia a été très gentille et a rendu cette expérience très confortable. C'était ma première séance photo professionnelle. Je ne pourrais pas la recommander davantage.",
    },
  },
  {
    id: "15bb7c85-2957-422c-a1df-f263acf58929",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Obrigado, Sr. José Santos, um grande profissional, super atencioso e simpático. Sem dúvida, um momento maravilhoso e emocionante que ofereceu às minhas meninas, que vão guardar no coração para sempre. Mais uma vez, obrigada — recomendo de coração!",
      de: "Danke, Herr José Santos — ein toller Profi, super aufmerksam und freundlich. Ohne Zweifel ein wunderbarer, emotionaler Moment, den Sie meinen Mädchen geschenkt haben, den sie für immer im Herzen tragen werden. Nochmals vielen Dank — ich empfehle Sie wirklich von Herzen!",
      es: "Gracias, Sr. José Santos, un gran profesional, súper atento y amable. Sin duda, un momento maravilloso y emocionante que les regalaste a mis niñas, que guardarán en el corazón para siempre. Gracias de nuevo — ¡lo recomiendo de corazón!",
      fr: "Merci, Monsieur José Santos, un grand professionnel, super attentionné et sympathique. Sans aucun doute, un moment merveilleux et émouvant que vous avez offert à mes filles, qu'elles garderont à jamais dans leur cœur. Merci encore — je le recommande de tout cœur !",
    },
  },
  {
    id: "d90c4d36-8bbb-441a-92a2-40cfb0cd1611",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Marcámos uma sessão fotográfica de família com a Patrícia durante as nossas férias em Portugal. É uma pessoa muito atenciosa e profissional. Houve uma comunicação excelente em cada passo, desde a escolha do local até à ajuda com os outfits. A nossa noite em Belém com a Patrícia (e o Fernando) é um dos pontos altos da viagem. As fotos foram entregues rapidamente e são verdadeiras obras de arte!",
      de: "Wir haben während unseres Urlaubs in Portugal ein Familienshooting mit Patrícia gebucht. Sie ist äußerst aufmerksam und professionell. Bei jedem Schritt — von der Wahl des Ortes bis zur Hilfe bei den Outfits — gab es eine perfekte Kommunikation. Unser Abend in Belém mit Patrícia (und Fernando) bleibt einer der Höhepunkte unserer Reise. Die Fotos wurden schnell geliefert und sind wahre Kunstwerke!",
      es: "Reservamos una sesión de familia con Patrícia durante nuestras vacaciones en Portugal. Es una persona muy atenta y profesional. Hubo una comunicación excelente en cada paso, desde la elección del lugar hasta la ayuda con los outfits. Nuestra tarde-noche en Belém con Patrícia (y Fernando) es uno de los grandes momentos de nuestro viaje. ¡Las fotos llegaron rápido y son verdaderas obras de arte!",
      fr: "Nous avons réservé une séance famille avec Patrícia pendant nos vacances au Portugal. C'est quelqu'un de très attentionné et professionnel. La communication a été excellente à chaque étape, du choix du lieu à l'aide pour les tenues. Notre soirée à Belém avec Patrícia (et Fernando) reste l'un des moments forts de notre voyage. Les photos ont été livrées rapidement et ce sont de véritables œuvres d'art !",
    },
  },
  {
    id: "060c502f-7d38-41c9-be5f-0ce103005a61",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fizemos uma sessão de casal em Sintra com a Patrícia e não podia estar mais feliz com toda a experiência! Do início ao fim foi uma profissional absoluta, trazendo imensa criatividade, calor e energia para a sessão.\nFez com que eu e o meu namorado nos sentíssemos completamente à vontade em frente à câmara, o que não é fácil. O que se destacou foi a sua atenção ao detalhe e a capacidade de captar momentos genuínos que refletem mesmo quem somos como casal.\nViu-se logo o quão apaixonada e talentosa é, mas também o cuidado que coloca em cada plano. O facto de o Fernando também ter ajudado tornou a sessão ainda mais divertida e descontraída — parecia que estávamos a passear todos juntos enquanto criávamos algo bonito.\nQuando recebi as fotos finais fiquei deslumbrada. Os resultados ultrapassaram em muito as minhas expectativas! Tem um olho incrível para a composição, a luz e a emoção, e cada foto parecia uma obra de arte.\nRecomendo a Patrícia de coração a quem procurar uma fotógrafa que vai além para criar algo verdadeiramente especial. Mal posso esperar para voltar a trabalhar com ela no futuro! ☺️",
      de: "Wir hatten ein Paar-Shooting in Sintra mit Patrícia und ich könnte mit dem gesamten Erlebnis nicht zufriedener sein! Von Anfang bis Ende war sie ein absoluter Profi und hat so viel Kreativität, Wärme und Energie in die Session gebracht.\nSie hat es geschafft, dass mein Freund und ich uns vor der Kamera vollkommen entspannt fühlten — was wirklich keine Kleinigkeit ist. Besonders aufgefallen sind ihre Liebe zum Detail und ihre Fähigkeit, echte Momente einzufangen, die wirklich zeigen, wer wir als Paar sind.\nMan hat sofort gemerkt, wie leidenschaftlich und talentiert sie ist, aber auch wie viel Sorgfalt sie in jede Aufnahme legt. Dass Fernando ebenfalls geholfen hat, hat die Session noch lustiger und entspannter gemacht — es fühlte sich an, als würden wir alle zusammen abhängen und nebenbei etwas Wunderschönes erschaffen.\nAls ich die finalen Fotos bekam, war ich überwältigt. Das Ergebnis hat meine Erwartungen weit übertroffen! Sie hat einen unglaublichen Blick für Komposition, Licht und Emotionen, und jedes Foto fühlte sich an wie ein Kunstwerk.\nIch empfehle Patrícia von ganzem Herzen jedem, der eine Fotografin sucht, die das gewisse Extra liefert. Ich kann es kaum erwarten, in Zukunft wieder mit ihr zu arbeiten! ☺️",
      es: "Hicimos una sesión de pareja en Sintra con Patrícia y no podría estar más feliz con toda la experiencia. De principio a fin fue una profesional absoluta, llevando muchísima creatividad, calidez y energía a la sesión.\nNos hizo sentir a mi novio y a mí totalmente cómodos delante de la cámara, lo cual no es fácil. Lo que destacó fue su atención al detalle y su capacidad para captar momentos genuinos que reflejan de verdad quiénes somos como pareja.\nSe nota muchísimo lo apasionada y talentosa que es, pero también el cuidado que pone en cada plano. Que Fernando también ayudara hizo que la sesión fuera aún más divertida y relajada — parecía que estábamos paseando todos juntos mientras creábamos algo bonito.\nCuando recibí las fotos finales me quedé alucinando. ¡Los resultados superaron con creces mis expectativas! Tiene un ojo increíble para la composición, la luz y la emoción, y cada foto parecía una obra de arte.\nRecomiendo a Patrícia de corazón a cualquiera que busque una fotógrafa que va más allá para crear algo realmente especial. ¡No veo la hora de volver a trabajar con ella en el futuro! ☺️",
      fr: "Nous avons fait une séance de couple à Sintra avec Patrícia et je ne pourrais pas être plus heureuse de toute l'expérience ! Du début à la fin, elle a été d'un professionnalisme absolu, apportant énormément de créativité, de chaleur et d'énergie à la séance.\nElle nous a mis, mon copain et moi, complètement à l'aise devant l'objectif, ce qui n'est pas évident. Ce qui s'est démarqué, c'est son souci du détail et sa capacité à capter des moments authentiques qui reflètent vraiment qui nous sommes en tant que couple.\nOn voyait clairement à quel point elle est passionnée et talentueuse, mais aussi le soin qu'elle met dans chaque cliché. Le fait que Fernando soit aussi présent a rendu la séance encore plus drôle et décontractée — c'était comme si nous traînions tous ensemble en train de créer quelque chose de magnifique.\nQuand j'ai reçu les photos finales, j'ai été soufflée. Les résultats ont largement dépassé mes attentes ! Elle a un œil incroyable pour la composition, la lumière et l'émotion, et chaque photo ressemble à une œuvre d'art.\nJe recommande de tout cœur Patrícia à toute personne cherchant une photographe qui va au-delà pour créer quelque chose de vraiment spécial. J'ai hâte de retravailler avec elle ! ☺️",
    },
  },
  {
    id: "3306cae5-1ff9-4698-ae09-c3d29461e725",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Fizemos recentemente uma sessão fotográfica com a Patrícia (e o Fernando) em Sintra, em casal, com os nossos dois cães. Apesar do vento, do frio e da humidade em Sintra, a sessão foi absolutamente maravilhosa. A Patrícia fez com que nos sentíssemos muito à vontade e ia perguntando se estávamos contentes com o rumo da sessão e se queríamos mudar alguma coisa. Foram adoráveis também com os cães. As fotos estão deslumbrantes e não podíamos estar mais felizes.",
      de: "Wir haben kürzlich ein Paar-Shooting mit Patrícia (und Fernando) in Sintra gemacht, zusammen mit unseren beiden Hunden. Trotz Wind, Kälte und Feuchtigkeit in Sintra war die Session absolut wunderbar. Patrícia hat dafür gesorgt, dass wir uns sehr wohlfühlen, und immer wieder gefragt, ob wir mit dem Verlauf zufrieden sind und ob wir etwas ändern möchten. Auch zu den Hunden waren die beiden ganz reizend. Die Fotos sind atemberaubend, und wir könnten nicht glücklicher sein.",
      es: "Recientemente hicimos una sesión de pareja con Patrícia (y Fernando) en Sintra junto con nuestros dos perros. A pesar del viento, el frío y la humedad de Sintra, la sesión fue absolutamente preciosa. Patrícia nos hizo sentir muy cómodos y nos iba preguntando si estábamos contentos con el rumbo de la sesión y si queríamos cambiar algo. Fueron encantadores también con los perros. Las fotos están alucinantes y no podríamos estar más contentos.",
      fr: "Nous avons récemment fait une séance photo de couple avec Patrícia (et Fernando) à Sintra, accompagnés de nos deux chiens. Malgré le vent, le froid et l'humidité à Sintra, la séance a été absolument adorable. Patrícia nous a mis très à l'aise et n'arrêtait pas de vérifier si nous étions contents du déroulement de la séance et si nous voulions changer quelque chose. Ils ont été adorables avec les chiens aussi. Les photos sont magnifiques et nous ne pourrions pas être plus heureux.",
    },
  },
  {
    id: "f51f9f1e-a1b2-4197-bb24-873196ee4b8e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "O ano de 2024 ficará para sempre gravado na minha memória graças aos momentos mágicos que vivi na companhia da Patrícia e do Fernando. Dois seres humanos absolutamente incríveis que conseguiram fazer-me sentir única e extremamente especial. Confesso que estava muito assustada porque não gosto de ter uma câmara apontada a mim, mas tudo foi mágico: o local, a seleção da música e, acima de tudo, a presença da Patrícia, que me ajudou a religar-me a mim mesma. Fiz uma viagem maravilhosa pela memória que vou guardar para sempre no coração. Naquela tarde senti-me viva e livre como há muito não me sentia! Obrigada ♥️ Desafio-vos a viver uma experiência única e absolutamente memorável! 😍",
      de: "Das Jahr 2024 wird sich für immer in meine Erinnerung einprägen — dank der magischen Momente, die ich an der Seite von Patrícia und Fernando erleben durfte. Zwei absolut unglaubliche Menschen, die es geschafft haben, dass ich mich einzigartig und ganz besonders gefühlt habe. Ich gebe zu, dass ich sehr ängstlich war, weil ich es nicht mag, wenn eine Kamera auf mich gerichtet ist — aber alles war magisch: der Ort, die Musikauswahl und vor allem Patrícias Präsenz, die mir geholfen hat, wieder zu mir selbst zu finden. Ich bin eine wunderbare Reise durch meine Erinnerungen gegangen, die ich für immer im Herzen tragen werde. An diesem Nachmittag habe ich mich lebendig und frei gefühlt, wie schon lange nicht mehr! Danke ♥️ Ich fordere euch heraus: Erlebt eine einzigartige und absolut unvergessliche Erfahrung! 😍",
      es: "El año 2024 quedará grabado para siempre en mi memoria gracias a los momentos mágicos que viví en compañía de Patrícia y Fernando. Dos seres humanos absolutamente increíbles que consiguieron hacerme sentir única y extremadamente especial. Confieso que tenía mucho miedo porque no me gusta tener una cámara apuntándome, pero todo fue mágico: el lugar, la selección de música y, sobre todo, la presencia de Patrícia, que me ayudó a reconectar conmigo misma. Hice un viaje maravilloso por la memoria que guardaré para siempre en el corazón. Esa tarde me sentí viva y libre como hacía mucho que no me sentía. Gracias ♥️ ¡Os reto a vivir una experiencia única y absolutamente memorable! 😍",
      fr: "L'année 2024 restera gravée à jamais dans ma mémoire grâce aux moments magiques que j'ai vécus en compagnie de Patrícia et Fernando. Deux êtres humains absolument incroyables qui ont réussi à me faire sentir unique et extrêmement spéciale. J'avoue que j'avais très peur parce que je n'aime pas avoir un objectif pointé sur moi, mais tout a été magique : le lieu, la sélection musicale et surtout la présence de Patrícia, qui m'a aidée à me reconnecter à moi-même. J'ai fait un magnifique voyage dans la mémoire que je garderai à jamais dans mon cœur. Cet après-midi-là, je me suis sentie vivante et libre comme cela ne m'était plus arrivé depuis longtemps ! Merci ♥️ Je vous mets au défi de vivre une expérience unique et absolument mémorable ! 😍",
    },
  },
  {
    id: "a72da229-faf0-4c0b-891c-3baf6fe2fbba",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Há muito que queria viver uma experiência destas com a Patrícia. No entanto, a vida deu uma volta quando tínhamos planeado fazê-lo. O que é certo é que, agora que aconteceu, posso dizer que aconteceu mesmo e que significou o meu renascimento como mulher e como ser humano. Estou a renascer das cinzas e das tempestades, e estar com a Patrícia provou que todas as situações acontecem por uma razão.\nA Patrícia é magia atrás da câmara e faz-nos sentir mágicos. Nunca me senti tão poderosa e tão humana ao mesmo tempo: tão eu mesma e tão capaz. É ser vulnerável e forte ao mesmo tempo ✨️🥹\nQuando recebi os resultados \"em bruto\" da nossa sessão, chorei, e olho para eles todos os dias — trabalho com as fotografias que ela me tirou — e estou verdadeiramente muito feliz, desde que decidi que ela vai fazer parte do meu futuro profissional — e pessoal.\n\"Escolhe-me\", porque vou estar lá para aplaudir todas as tuas vitórias e conquistas, e vamos avançar juntas para o futuro 🧡🦋",
      de: "Schon lange wollte ich eine Erfahrung wie diese mit Patrícia teilen. Doch das Leben hat eine Wendung genommen, als wir geplant hatten, es zu tun. Sicher ist: Jetzt, da es endlich passiert ist, kann ich sagen, dass es wirklich geschehen ist und dass es meine Wiedergeburt als Frau und als Mensch bedeutet hat. Ich erhebe mich aus Asche und harten Stürmen, und die Zeit mit Patrícia hat bewiesen, dass alle Dinge aus einem Grund geschehen.\nPatrícia ist Magie hinter der Kamera und lässt uns selbst magisch fühlen. Ich habe mich noch nie gleichzeitig so stark und so menschlich gefühlt: so sehr ich selbst und so fähig. Es ist gleichzeitig verletzlich und stark zu sein ✨️🥹\nAls ich die „rohen\" Ergebnisse unserer Session bekam, habe ich geweint, und ich schaue sie mir täglich an — ich arbeite mit den Fotos, die sie von mir gemacht hat — und ich bin wirklich sehr glücklich, seit ich entschieden habe, dass sie Teil meiner beruflichen — und persönlichen — Zukunft sein wird.\n„Choose me\" („Wähle mich\"), denn ich werde da sein, um all deine Siege und Erfolge zu beklatschen, und gemeinsam gehen wir der Zukunft entgegen 🧡🦋",
      es: "Hace mucho tiempo que quería vivir una experiencia así con Patrícia. Pero la vida dio un giro cuando habíamos planeado hacerlo. Lo cierto es que, ahora que ha sucedido, puedo decir que sí ocurrió y que significó mi renacer como mujer y como ser humano. Estoy resurgiendo de cenizas y de duras tormentas, y estar con Patrícia me demostró que todas las situaciones suceden por una razón.\nPatrícia es magia detrás de la cámara y nos hace sentir mágicos. Nunca me había sentido tan empoderada y tan humana al mismo tiempo: tan yo misma y tan capaz. Es ser vulnerable y fuerte a la vez ✨️🥹\nCuando recibí los resultados \"en bruto\" de nuestra sesión lloré, y los miro a diario —trabajo con las fotografías que ella me hizo— y soy realmente muy feliz, desde que decidí que ella va a formar parte de mi futuro profesional —y personal—.\n\"Choose me\" (\"Elígeme\"), porque voy a estar ahí para aplaudir todas tus victorias y conquistas, y avanzaremos juntas hacia el futuro 🧡🦋",
      fr: "Cela faisait longtemps que je voulais vivre une expérience comme celle-ci avec Patrícia. Mais la vie a pris un tournant alors que nous l'avions prévue. Ce qui est sûr, c'est que maintenant que c'est arrivé, je peux dire que cela s'est vraiment produit et que cela a signifié ma renaissance en tant que femme et en tant qu'être humain. Je renais de mes cendres et des tempêtes que j'ai traversées, et le temps passé avec Patrícia m'a prouvé que toutes les situations arrivent pour une raison.\nPatrícia, c'est de la magie derrière l'objectif, et elle nous donne le sentiment d'être magiques. Je ne m'étais jamais sentie aussi forte et aussi humaine en même temps : aussi moi-même et aussi capable. C'est être vulnérable et forte à la fois ✨️🥹\nQuand j'ai reçu les résultats \"bruts\" de notre séance, j'ai pleuré, et je les regarde tous les jours — je travaille avec les photographies qu'elle m'a faites — et je suis vraiment très heureuse, depuis que j'ai décidé qu'elle ferait partie de mon avenir professionnel — et personnel.\n« Choose me » (« Choisis-moi »), parce que je serai là pour applaudir toutes tes victoires et tes accomplissements, et nous avancerons ensemble vers l'avenir 🧡🦋",
    },
  },
  {
    id: "1aaafaba-ad08-4d4f-9193-c01beb3d448e",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Recomendo vivamente esta equipa espetacular para qualquer ocasião especial! Adorámos trabalhar com a Mónica e o Carlos no nosso casamento!\nJá seguia o trabalho deles no Instagram e adorava as fotos — tão bem captadas e super naturais — tanto que, quando começámos a organizar o casamento, soube logo que eram os fotógrafos que queria!\nO profissionalismo e a atenção marcaram presença desde o primeiro contacto por email até à entrega das fotos — a Mónica foi proativa, comunicativa, sempre pronta a responder às nossas dúvidas e a perguntar pelas nossas preferências para o dia! Para além disso, foi uma ótima coordenadora para nós, porque não temos jeito nenhum para posar 😂\nNo dia, ela e o Carlos foram pontuais e tiraram fotos lindas que tanto nós como os convidados adorámos!\nObrigada, Canto, por ajudarem a tornar o nosso dia ainda mais especial 🩷\nDaniela & Liam",
      de: "Ich empfehle dieses spektakuläre Team für jeden besonderen Anlass wärmstens! Wir haben es geliebt, mit Mónica und Carlos auf unserer Hochzeit zu arbeiten!\nIch hatte ihre Arbeit schon auf Instagram verfolgt und ihre Fotos immer geliebt — so gut eingefangen und super natürlich — sodass ich, als wir mit der Hochzeitsplanung begannen, sofort wusste: Sie sollten unsere Fotografen sein!\nProfessionalität und Aufmerksamkeit waren vom ersten E-Mail-Kontakt bis zur Übergabe der Fotos allgegenwärtig — Mónica war proaktiv, kommunikativ und immer bereit, unsere Fragen zu beantworten und sich nach unseren Wünschen für den Tag zu erkundigen. Außerdem war sie für uns eine großartige „Coach\", denn wir sind beim Posieren absolut nicht in unserem Element 😂\nAm Hochzeitstag waren sie und Carlos pünktlich und haben wunderschöne Fotos gemacht, die sowohl wir als auch unsere Gäste geliebt haben!\nDanke, Canto, dass ihr unseren Tag noch besonderer gemacht habt 🩷\nDaniela & Liam",
      es: "¡Recomiendo muchísimo a este equipo espectacular para cualquier ocasión especial! ¡Nos encantó trabajar con Mónica y Carlos en nuestra boda!\nYa seguía su trabajo en Instagram y siempre me encantaban sus fotos — tan bien captadas y súper naturales — así que cuando empezamos a organizar la boda supe enseguida que eran los fotógrafos que quería.\nLa profesionalidad y la atención estuvieron presentes desde el primer email hasta la entrega de las fotos — Mónica fue proactiva, comunicativa, siempre dispuesta a responder nuestras dudas y a preguntar por nuestras preferencias para el día. Además, fue una gran coordinadora para nosotros, porque no se nos da nada bien posar 😂\nEl día de la boda, ella y Carlos fueron puntuales e hicieron unas fotos preciosas que tanto nosotros como los invitados adoramos.\n¡Gracias, Canto, por ayudar a hacer nuestro día aún más especial! 🩷\nDaniela & Liam",
      fr: "Je recommande vivement cette équipe spectaculaire pour toute occasion spéciale ! Nous avons adoré travailler avec Mónica et Carlos à notre mariage !\nJe suivais déjà leur travail sur Instagram et j'adorais leurs photos — si bien captées et tellement naturelles — au point que, dès que nous avons commencé à organiser le mariage, j'ai su immédiatement que c'étaient les photographes que je voulais !\nLe professionnalisme et l'attention ont régné dès le premier e-mail jusqu'à la livraison des photos — Mónica a été proactive, communicative, toujours prête à répondre à nos questions et à se renseigner sur nos préférences pour la journée ! En plus, elle a été une super coordinatrice pour nous, parce que nous ne sommes vraiment pas à l'aise pour poser 😂\nLe jour J, elle et Carlos étaient ponctuels et ont fait de magnifiques photos que nous comme nos invités avons adorées !\nMerci, Canto, d'avoir contribué à rendre notre journée encore plus spéciale 🩷\nDaniela & Liam",
    },
  },
  {
    id: "ce193f03-4166-4089-9fcf-bf680fcc3e0d",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "Que experiência incrível!! Profissionalismo, simpatia e diversão. Adorei 🥰\nRecomendo super, super, super. Uma experiência para repetir, sem dúvida.",
      de: "Was für ein unglaubliches Erlebnis!! Professionalität, Freundlichkeit und Spaß. Ich war begeistert 🥰\nIch empfehle es sehr, sehr, sehr. Auf jeden Fall eine Erfahrung, die man wiederholen muss.",
      es: "¡¡Qué experiencia tan increíble!! Profesionalidad, simpatía y diversión. Me encantó 🥰\nLo recomiendo súper, súper, súper. Una experiencia para repetir, sin duda.",
      fr: "Quelle expérience incroyable !! Professionnalisme, gentillesse et fun. J'ai adoré 🥰\nJe recommande hyper, hyper, hyper. Une expérience à refaire, sans hésitation.",
    },
  },
  {
    id: "46f7432e-a72b-411e-bab4-65e7771dd898",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "A Sophie tirou fotos no nosso casamento e quando a nossa filha nasceu. Tem simplesmente uma forma agradável e não invasiva de tirar fotos autênticas, que não parecem posadas — exatamente o que mais queríamos. Entre outras fotos lindas de nós e do cenário, captou ótimos retratos de personagem dos convidados do nosso casamento, que ainda hoje nos fazem sorrir. Durante a sessão com a nossa recém-nascida, a Sophie captou as primeiras expressões adoráveis, aquelas que esperamos nunca esquecer! Muito obrigada, querida Sophie!",
      de: "Sophie hat sowohl auf unserer Hochzeit als auch nach der Geburt unserer Tochter Fotos gemacht. Sie hat einfach eine angenehme und unaufdringliche Art, authentische Bilder zu machen, die nicht gestellt wirken — genau das, was wir uns am meisten gewünscht haben. Neben anderen wunderschönen Bildern von uns und der Umgebung hat sie tolle Charakterporträts unserer Hochzeitsgäste gemacht, über die wir heute noch schmunzeln. Beim Shooting mit unserer Neugeborenen hat Sophie die ersten süßen Gesichtsausdrücke eingefangen — die, die man nie vergessen möchte! Vielen Dank, liebe Sophie!",
      es: "Sophie hizo fotos en nuestra boda y cuando nació nuestra hija. Tiene una forma muy agradable y nada invasiva de hacer fotos auténticas, que no parecen posadas, y eso era justo lo que más queríamos. Entre otras fotos preciosas de nosotros y del entorno, hizo unos retratos de personalidad geniales de los invitados a nuestra boda, que todavía hoy nos hacen sonreír. En la sesión con nuestra recién nacida, Sophie captó las primeras expresiones tiernas, esas que esperas no olvidar nunca. ¡Muchísimas gracias, querida Sophie!",
      fr: "Sophie a fait des photos à notre mariage et à la naissance de notre fille. Elle a tout simplement une manière agréable et non intrusive de prendre des photos authentiques, qui ne paraissent pas posées — exactement ce que nous voulions le plus. Parmi d'autres magnifiques photos de nous et du décor, elle a réalisé de superbes portraits des invités de notre mariage, qui nous font encore sourire aujourd'hui. Lors du shooting avec notre nouveau-née, Sophie a capturé les premières expressions adorables, celles qu'on espère ne jamais oublier ! Merci infiniment, chère Sophie !",
    },
  },
  {
    id: "08930594-4c83-4c5b-a914-641576ddd920",
    title: { pt: "", de: "", es: "", fr: "" },
    text: {
      pt: "No início da minha sessão fotográfica estava super nervosa e, sinceramente, nem sequer tinha a certeza de que me apetecia fazê-la. Mas depois falei com a Sophie e ela fez-me sentir super à vontade logo de início. Tirou-me todos os medos por completo e senti-me super relaxada durante toda a sessão.\nA experiência foi absolutamente incrível. Já sabia que a Sophie era boa, mas quando vi as minhas fotos pensei: meu Deus, ela é fantástica! Estou super grata por ter feito esta sessão com ela e mal posso esperar para fazer outra em breve, porque ela é mesmo assim de boa.\nMuito obrigada, Sophie! 😊",
      de: "Zu Beginn meines Fotoshootings war ich super nervös und ehrlich gesagt nicht einmal sicher, ob ich überhaupt Lust darauf hatte. Aber dann habe ich mit Sophie gesprochen, und sie hat mir sofort das Gefühl gegeben, mich komplett wohlzufühlen. Sie hat mir all meine Ängste genommen, und ich war während des ganzen Shootings total entspannt.\nDie Erfahrung war einfach unglaublich. Ich wusste, dass Sophie gut ist, aber als ich meine Bilder sah, dachte ich: Oh mein Gott, sie ist fantastisch! Ich bin so dankbar, dass ich dieses Shooting mit ihr gemacht habe, und ich kann es kaum erwarten, bald wieder eines zu machen, weil sie wirklich so gut ist.\nVielen Dank, Sophie! 😊",
      es: "Al principio de mi sesión estaba súper nerviosa y, sinceramente, ni siquiera estaba segura de tener ganas de hacerla. Pero entonces hablé con Sophie y me hizo sentir cómoda enseguida. Me quitó todos los miedos por completo y me sentí súper relajada durante toda la sesión.\nLa experiencia fue absolutamente increíble. Ya sabía que Sophie era buena, pero cuando vi mis fotos pensé: ¡madre mía, es una maravilla! Estoy súper agradecida de haber hecho esta sesión con ella y no veo la hora de hacer otra pronto, porque es así de buena.\nMuchísimas gracias, Sophie! 😊",
      fr: "Au début de ma séance photo, j'étais super stressée et, honnêtement, je n'étais même pas sûre d'avoir envie de la faire. Mais ensuite j'ai parlé avec Sophie et elle m'a tout de suite mise à l'aise. Elle a complètement chassé toutes mes peurs et je me suis sentie super détendue pendant toute la séance.\nL'expérience a été absolument incroyable. Je savais déjà que Sophie était douée, mais quand j'ai vu mes photos, je me suis dit : oh mon Dieu, elle est fantastique ! Je suis super reconnaissante d'avoir fait cette séance avec elle et j'ai hâte d'en refaire une bientôt, parce qu'elle est vraiment douée à ce point.\nMerci beaucoup, Sophie ! 😊",
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
console.log(`\nBatch rev-2 done — ${REV.length} reviews translated.`);
